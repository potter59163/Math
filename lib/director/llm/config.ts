import { CONFIG } from '@/lib/config';

// LLM_* are read on the server alone (AI_DIRECTOR §7). With LLM_PROVIDER unset or `none`, or with no key,
// the tutor is simply off and the rules decide everything, which is a fully working app and not a
// degraded one.

/**
 * Potter's choice on 25 Nov 2026, for better Thai and better choices, with credits to spare. Claude Haiku
 * 5.5 (`claude-haiku-5-5`) was the model through the trial; LLM_MODEL still picks any other.
 */
const DEFAULT_MODEL = 'claude-sonnet-5-5';

/**
 * `off`: the model answers without extended thinking. `adaptive`: the model decides whether to think at
 * all; at `low` effort it skips thinking on most simple requests. Measured with `npm run eval:director`
 * on 25 Nov 2026 (AI_DIRECTOR §7): on Claude Sonnet 5.5 adaptive was both quicker and more often valid
 * (93% against 88%, p95 3.9 s against 7.3 s); on Claude Haiku 5.5 thinking took answers past the limit.
 */
export type LlmThinking = 'off' | 'adaptive';

function defaultThinking(model: string): LlmThinking {
  return model === 'claude-sonnet-5-5' ? 'adaptive' : 'off';
}

export interface LlmConfig {
  model: string;
  apiKey: string;
  timeoutMs: number;
  /** LLM_THINKING, else what was measured best for the model. */
  thinking?: LlmThinking;
}

export function llmConfig(env: Record<string, string | undefined> = process.env): LlmConfig | null {
  const apiKey = env.LLM_API_KEY ?? '';
  if (env.LLM_PROVIDER !== 'anthropic' || !apiKey) return null;
  const timeoutMs = Number(env.LLM_TIMEOUT_MS);
  const model = env.LLM_MODEL || DEFAULT_MODEL;
  const thinking = env.LLM_THINKING;
  return {
    model,
    apiKey,
    timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : CONFIG.llm.timeoutMs,
    thinking: thinking === 'adaptive' || thinking === 'off' ? thinking : defaultThinking(model),
  };
}

export function llmEnabled(): boolean {
  return llmConfig() !== null;
}
