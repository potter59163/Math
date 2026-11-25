import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import type { LlmConfig } from './config';
import { LlmDecision } from './schema';

// The one call to Claude (AI_DIRECTOR §7). Whatever comes back is only ever text: the caller checks every
// field of it with validateDecision before anything is used.

export interface CompleteArgs {
  system: string;
  user: string;
  signal: AbortSignal;
}

export interface LlmProvider {
  completeJson(args: CompleteArgs): Promise<string>;
}

/**
 * Thai takes many tokens per character, and any thinking counts towards this too. What stops a long answer
 * is the clock in decide.ts, so this only has to be sure of never cutting a good one short.
 */
const MAX_OUTPUT_TOKENS = 4096;

/**
 * Claude Sonnet 5.5 refuses `thinking: {type: 'disabled'}` with a 400 and turns thinking off with
 * `between_tools`, which every other model refuses. Sending the wrong one would fail every call, and the
 * students would only ever get the rules, with nobody told.
 */
export function isSonnet55(model: string): boolean {
  return model === 'claude-sonnet-5-5';
}

/**
 * Server-side fallback on a refusal: Claude Sonnet 5.5 declines in more categories than earlier models,
 * and `default` routes a decline by its category without a model list to keep. A decline it does not
 * retry, or a retry that misses the time limit, still ends in the rules, as before.
 */
const SONNET_55_FALLBACK_BETA = 'server-side-fallback-2026-07-01';

/** The API answered 429. */
export class RateLimitedError extends Error {}

function textOf(response: { stop_reason: string | null; content: { type: string }[] }): string {
  if (response.stop_reason === 'refusal') throw new Error('refused');
  const text = response.content.find((block) => block.type === 'text') as
    { type: 'text'; text: string } | undefined;
  if (!text) throw new Error('no text in response');
  return text.text;
}

export function createProvider({ apiKey, model, thinking = 'off' }: LlmConfig): LlmProvider {
  // No retries: a second try cannot fit in the seconds a student is waiting, and the rules are ready.
  const client = new Anthropic({ apiKey, maxRetries: 0 });
  // Not z.toJSONSchema: the API refuses length limits, and this helper moves them out of the way. Those
  // limits still hold, because validateDecision checks the answer against the same LlmDecision.
  const format = zodOutputFormat(LlmDecision);
  const betaFormat = betaZodOutputFormat(LlmDecision);
  // The same long prompt on every call, and a cached one costs a tenth to read.
  const system = (text: string) => [
    { type: 'text' as const, text, cache_control: { type: 'ephemeral' as const } },
  ];

  async function sonnet55({ system: prompt, user, signal }: CompleteArgs): Promise<string> {
    const response = await client.beta.messages.create(
      {
        model,
        max_tokens: MAX_OUTPUT_TOKENS,
        system: system(prompt),
        messages: [{ role: 'user', content: user }],
        // Left out, thinking is adaptive: at `low` effort the model skips it on most simple requests.
        ...(thinking === 'off' ? { thinking: { type: 'between_tools' as const } } : {}),
        output_config: { effort: 'low', format: betaFormat },
        betas: [SONNET_55_FALLBACK_BETA],
        fallbacks: 'default',
      },
      { signal },
    );
    return textOf(response);
  }

  async function otherModels({ system: prompt, user, signal }: CompleteArgs): Promise<string> {
    const response = await client.messages.create(
      {
        model,
        max_tokens: MAX_OUTPUT_TOKENS,
        system: system(prompt),
        messages: [{ role: 'user', content: user }],
        // Measured on Claude Haiku 5.5: thinking tripled the output and took answers with a clip past the
        // time limit, for a short choice among candidates the rules have already vetted.
        ...(thinking === 'off' ? { thinking: { type: 'disabled' as const } } : {}),
        output_config: { effort: 'low', format },
      },
      { signal },
    );
    return textOf(response);
  }

  return {
    async completeJson(args) {
      try {
        return await (isSonnet55(model) ? sonnet55(args) : otherModels(args));
      } catch (error) {
        if (error instanceof Anthropic.RateLimitError) throw new RateLimitedError();
        throw error;
      }
    },
  };
}
