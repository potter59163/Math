import { CONFIG } from '@/lib/config';
import { fillStudentText, resolveTokens } from '@/lib/director/tokens';
import type { PreparedAttempt } from '@/lib/director/rules';
import type { FallbackReason } from '@/lib/director/types';
import type { Decide } from '@/lib/server/sync';
import { llmConfig, type LlmConfig } from './config';
import { buildDirectorInput } from './input';
import { systemPrompt } from './prompt';
import { createProvider, RateLimitedError, type LlmProvider } from './providers';
import { validateDecision } from './validate';

const MINUTE_MS = 60_000;

export interface DeciderOptions {
  userId: string;
  store: { llmCallsSince(userId: string, since: string): Promise<number> };
  config?: LlmConfig | null;
  provider?: LlmProvider;
  now?: () => number;
}

function fallbackFor(error: unknown, signal: AbortSignal): FallbackReason {
  if (signal.aborted) return 'timeout';
  return error instanceof RateLimitedError ? 'rate_limited' : 'provider_error';
}

/** The tutor's choice and words for one answer, or the reason there are none. Never throws. */
export async function decideWithLlm(
  prepared: PreparedAttempt,
  {
    timeMs,
    hintLevel,
    provider,
    timeoutMs,
    now,
  }: {
    timeMs: number;
    hintLevel: number;
    provider: LlmProvider;
    timeoutMs: number;
    now: () => number;
  },
): ReturnType<Decide> {
  const { candidates, attempt } = prepared;
  const { item, answer } = attempt;
  const started = now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const latency = () => now() - started;
  try {
    const input = buildDirectorInput(prepared, timeMs, hintLevel);
    const text = await provider.completeJson({
      system: systemPrompt(),
      user: JSON.stringify(input),
      signal: controller.signal,
    });
    const checked = validateDecision({
      text,
      candidates,
      allowedTokens: input.allowedTokens,
      revealAllowed: true,
      sizes: resolveTokens(item, answer, { revealAllowed: true }),
    });
    if (!checked.ok) return { tutor: { fallbackReason: checked.reason, latencyMs: latency() } };

    const { decision, chosen } = checked;
    const fill = (line: string) => fillStudentText(line, item, answer, { revealAllowed: true });
    const narration = decision.narration?.length
      ? Object.fromEntries(decision.narration.map(({ beat, text: line }) => [beat, fill(line)]))
      : undefined;
    return {
      choice: chosen.id,
      mode: 'llm',
      tutor: {
        message: fill(decision.message),
        ...(narration && { narration }),
        reason: decision.reason,
        latencyMs: latency(),
      },
    };
  } catch (error) {
    const fallbackReason = fallbackFor(error, controller.signal);
    // A rejected request looks to a student just like a slow one, so this line is the only sign of it.
    if (fallbackReason === 'provider_error') {
      console.error(`tutor: ${error instanceof Error ? error.message : String(error)}`);
    }
    return { tutor: { fallbackReason, latencyMs: latency() } };
  } finally {
    clearTimeout(timer);
  }
}

/** Null when no provider is set up, and then the rules decide with nothing asked of anyone. */
export function llmDecider({
  userId,
  store,
  config = llmConfig(),
  provider,
  now = Date.now,
}: DeciderOptions): Decide | null {
  if (!config) return null;
  const llm = provider ?? createProvider(config);
  return async (prepared, { timeMs, hintLevel }) => {
    const since = new Date(now() - MINUTE_MS).toISOString();
    if ((await store.llmCallsSince(userId, since)) >= CONFIG.llm.maxCallsPerMinutePerStudent) {
      return { tutor: { fallbackReason: 'rate_limited' } };
    }
    return decideWithLlm(prepared, {
      timeMs,
      hintLevel,
      provider: llm,
      timeoutMs: config.timeoutMs,
      now,
    });
  };
}
