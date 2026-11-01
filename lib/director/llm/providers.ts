import Anthropic from '@anthropic-ai/sdk';
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

/** The API answered 429. */
export class RateLimitedError extends Error {}

export function createProvider({ apiKey, model }: LlmConfig): LlmProvider {
  // No retries: a second try cannot fit in the seconds a student is waiting, and the rules are ready.
  const client = new Anthropic({ apiKey, maxRetries: 0 });
  // Not z.toJSONSchema: the API refuses length limits, and this helper moves them out of the way. Those
  // limits still hold, because validateDecision checks the answer against the same LlmDecision.
  const format = zodOutputFormat(LlmDecision);
  return {
    async completeJson({ system, user, signal }) {
      try {
        const response = await client.messages.create(
          {
            model,
            max_tokens: MAX_OUTPUT_TOKENS,
            // The same long prompt on every call, and a cached one costs a tenth to read.
            system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
            messages: [{ role: 'user', content: user }],
            // Measured on real calls: thinking tripled the output and took answers with a clip past the
            // 4 s limit, for a short choice among candidates the rules have already vetted.
            thinking: { type: 'disabled' },
            output_config: { effort: 'low', format },
          },
          { signal },
        );
        if (response.stop_reason === 'refusal') throw new Error('refused');
        const text = response.content.find((block) => block.type === 'text');
        if (!text || text.type !== 'text') throw new Error('no text in response');
        return text.text;
      } catch (error) {
        if (error instanceof Anthropic.RateLimitError) throw new RateLimitedError();
        throw error;
      }
    },
  };
}
