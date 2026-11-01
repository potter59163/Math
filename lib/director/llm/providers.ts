import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import type { LlmConfig } from './config';
import { LlmDecision } from './schema';

// One small interface over each provider (AI_DIRECTOR §7). Whatever comes back is only ever text: the
// caller checks every field of it with validateDecision before anything is used.

export interface CompleteArgs {
  system: string;
  user: string;
  signal: AbortSignal;
}

export interface LlmProvider {
  completeJson(args: CompleteArgs): Promise<string>;
}

/** Plenty for two sentences and six captions in Thai, which takes many tokens per character. */
const MAX_OUTPUT_TOKENS = 1024;

/** A 429, whichever provider sent it. */
export class RateLimitedError extends Error {}

function anthropicProvider({ apiKey, model }: LlmConfig): LlmProvider {
  // No retries: a second try cannot fit in the seconds a student is waiting, and the rules are ready.
  const client = new Anthropic({ apiKey, maxRetries: 0 });
  const schema = z.toJSONSchema(LlmDecision);
  return {
    async completeJson({ system, user, signal }) {
      try {
        const response = await client.messages.create(
          {
            model,
            max_tokens: MAX_OUTPUT_TOKENS,
            system,
            messages: [{ role: 'user', content: user }],
            output_config: {
              // A short choice under a hard clock: thinking at length costs more than it brings.
              effort: 'low',
              format: { type: 'json_schema', schema: schema as Record<string, unknown> },
            },
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

async function postJson(
  url: string,
  headers: Record<string, string>,
  body: unknown,
  signal: AbortSignal,
) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
    signal,
  });
  if (response.status === 429) throw new RateLimitedError();
  if (!response.ok) throw new Error(`provider answered ${response.status}`);
  return (await response.json()) as unknown;
}

function geminiProvider({ apiKey, model }: LlmConfig): LlmProvider {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  return {
    async completeJson({ system, user, signal }) {
      const data = (await postJson(
        url,
        { 'x-goog-api-key': apiKey },
        {
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: 'user', parts: [{ text: user }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            maxOutputTokens: MAX_OUTPUT_TOKENS,
          },
        },
        signal,
      )) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error('no text in response');
      return text;
    },
  };
}

function openaiProvider({ apiKey, model }: LlmConfig): LlmProvider {
  return {
    async completeJson({ system, user, signal }) {
      const data = (await postJson(
        'https://api.openai.com/v1/chat/completions',
        { Authorization: `Bearer ${apiKey}` },
        {
          model,
          max_completion_tokens: MAX_OUTPUT_TOKENS,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
        },
        signal,
      )) as { choices?: { message?: { content?: string } }[] };
      const text = data.choices?.[0]?.message?.content;
      if (!text) throw new Error('no text in response');
      return text;
    },
  };
}

export function createProvider(config: LlmConfig): LlmProvider {
  switch (config.provider) {
    case 'anthropic':
      return anthropicProvider(config);
    case 'gemini':
      return geminiProvider(config);
    case 'openai':
      return openaiProvider(config);
  }
}
