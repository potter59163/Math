import { CONFIG } from '@/lib/config';

// LLM_* are read on the server alone (AI_DIRECTOR §7). With LLM_PROVIDER unset or `none`, or with no key,
// the tutor is simply off and the rules decide everything, which is a fully working app and not a
// degraded one.

/** Fast and cheap, as AI_DIRECTOR §7 asks: one call per answer, with a student waiting on it. */
const DEFAULT_MODEL = 'claude-haiku-5-5';

export interface LlmConfig {
  model: string;
  apiKey: string;
  timeoutMs: number;
}

export function llmConfig(env: Record<string, string | undefined> = process.env): LlmConfig | null {
  const apiKey = env.LLM_API_KEY ?? '';
  if (env.LLM_PROVIDER !== 'anthropic' || !apiKey) return null;
  const timeoutMs = Number(env.LLM_TIMEOUT_MS);
  return {
    model: env.LLM_MODEL || DEFAULT_MODEL,
    apiKey,
    timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : CONFIG.llm.timeoutMs,
  };
}

export function llmEnabled(): boolean {
  return llmConfig() !== null;
}
