import { CONFIG } from '@/lib/config';

// LLM_* are read on the server alone (AI_DIRECTOR §7). With no provider or no key the tutor is simply
// off and the rules decide everything, which is a fully working app and not a degraded one.

export type ProviderName = 'gemini' | 'anthropic' | 'openai';

const PROVIDERS: readonly string[] = ['gemini', 'anthropic', 'openai'];

/** Fast and cheap, as AI_DIRECTOR §7 asks: one call per answer, with a student waiting on it. */
const DEFAULT_MODEL: Record<ProviderName, string> = {
  anthropic: 'claude-haiku-5-5',
  gemini: 'gemini-2.5-flash',
  openai: 'gpt-5-mini',
};

export interface LlmConfig {
  provider: ProviderName;
  model: string;
  apiKey: string;
  timeoutMs: number;
}

export function llmConfig(env: Record<string, string | undefined> = process.env): LlmConfig | null {
  const provider = env.LLM_PROVIDER ?? 'none';
  const apiKey = env.LLM_API_KEY ?? '';
  if (!PROVIDERS.includes(provider) || !apiKey) return null;
  const name = provider as ProviderName;
  const timeoutMs = Number(env.LLM_TIMEOUT_MS);
  return {
    provider: name,
    model: env.LLM_MODEL || DEFAULT_MODEL[name],
    apiKey,
    timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : CONFIG.llm.timeoutMs,
  };
}

export function llmEnabled(): boolean {
  return llmConfig() !== null;
}
