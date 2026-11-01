import { describe, expect, it, vi } from 'vitest';
import { commitAttempt, prepareAttempt } from '@/lib/director/rules';
import { newProfile } from '@/lib/director/turn';
import type { Candidate } from '@/lib/director/types';
import { misconceptionAnswer } from '@/lib/sim/answers';
import { generate } from '@/lib/topics/matrix/generators';
import { llmConfig } from './config';
import { decideWithLlm, llmDecider } from './decide';
import { buildDirectorInput } from './input';
import { systemPrompt } from './prompt';
import { RateLimitedError, type LlmProvider } from './providers';
import { hasNumberInWords, validateDecision } from './validate';

const AT = 1_800_000_000_000;

function prepared() {
  const item = generate({ skill: 'mult', difficulty: 1, seed: 3, target: 'M09_MULT_ELEMENTWISE' });
  const answer = misconceptionAnswer(item, 'M09_MULT_ELEMENTWISE')!;
  const student = newProfile({ id: 'secret-user-id', units: [1, 2, 3, 4, 5], theme: 'game' });
  return prepareAttempt(student, { item, answer, hintLevel: 0, timeMs: 41000, at: AT });
}

const answering = (text: string): LlmProvider => ({ completeJson: async () => text });

const options = (provider: LlmProvider) => ({
  timeMs: 41000,
  hintLevel: 0,
  provider,
  timeoutMs: 4000,
  now: Date.now,
});

const check = (text: string, candidates: readonly Candidate[], revealAllowed = true) =>
  validateDecision({
    text,
    candidates,
    allowedTokens: ['i', 'j', 'aCell', 'correctCell'],
    revealAllowed,
  });

const decision = (change: object = {}) =>
  JSON.stringify({
    choice: 'c1',
    message: 'ลองดูช่องแถว {{i}} นะ',
    reason: 'เหตุผลสำหรับบันทึก',
    ...change,
  });

describe('validateDecision (AI_DIRECTOR §4.3)', () => {
  const { candidates } = prepared();
  const beat = candidates[0].scene!.beats[0];

  it('accepts a good decision', () => {
    expect(check(decision(), candidates).ok).toBe(true);
  });
  it('accepts narration on a real beat of the chosen clip', () => {
    expect(check(decision({ narration: [{ beat, text: 'ดูแถว {{i}}' }] }), candidates).ok).toBe(
      true,
    );
  });
  it('unwraps a code fence, which providers add even when told not to', () => {
    expect(check(`\`\`\`json\n${decision()}\n\`\`\``, candidates).ok).toBe(true);
  });

  it.each([
    ['not json', 'not json at all', 'schema_invalid'],
    ['a missing field', JSON.stringify({ choice: 'c1', message: 'x' }), 'schema_invalid'],
    ['an extra field', decision({ extra: 1 }), 'schema_invalid'],
    ['a message too long', decision({ message: 'ก'.repeat(161) }), 'schema_invalid'],
    ['a candidate that does not exist', decision({ choice: 'c4' }), 'choice_invalid'],
    ['a digit', decision({ message: 'ได้ 5 นะ' }), 'digit_violation'],
    ['a Thai digit', decision({ message: 'ได้ ๕ นะ' }), 'digit_violation'],
    ['a superscript', decision({ message: 'เป็น k² เท่า' }), 'digit_violation'],
    ['a number in words', decision({ message: 'ได้สิบเอ็ดนะ' }), 'digit_violation'],
    ['a token not allowed', decision({ message: 'ได้ {{det}} นะ' }), 'token_violation'],
    ['a stray brace', decision({ message: 'ได้ {i} นะ' }), 'token_violation'],
    [
      'a beat not in the clip',
      decision({ narration: [{ beat: 'nope', text: 'x' }] }),
      'beat_invalid',
    ],
  ])('refuses %s', (_name, text, reason) => {
    const result = check(text, candidates);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe(reason);
  });

  it('refuses a digit in narration too', () => {
    const result = check(decision({ narration: [{ beat, text: 'ได้ 5' }] }), candidates);
    expect(result).toEqual({ ok: false, reason: 'digit_violation' });
  });

  it('refuses a token that gives the answer away while the item is open', () => {
    const result = check(decision({ message: 'คือ {{correctCell}}' }), candidates, false);
    expect(result).toEqual({ ok: false, reason: 'token_violation' });
  });

  it('allows digits in the reason, which only the log sees', () => {
    expect(check(decision({ reason: 'mastery 0.31 ครั้งที่ 1' }), candidates).ok).toBe(true);
  });
});

describe('hasNumberInWords', () => {
  it.each(['ได้สิบเอ็ด', 'คูณสอง', 'ผลคือศูนย์', 'มีห้าช่อง', 'หนึ่งร้อย'])(
    'catches %s',
    (text) => {
      expect(hasNumberInWords(text)).toBe(true);
    },
  );
  it.each(['สามารถทำได้', 'ห้ามลืม', 'เรียบร้อยแล้ว', 'ความสัมพันธ์', 'ก้าวหน้า', 'ลองอีกข้อนะ'])(
    'leaves %s alone, which only looks like a number',
    (text) => {
      expect(hasNumberInWords(text)).toBe(false);
    },
  );
});

describe('what the tutor is told', () => {
  it('holds nothing that identifies the student', () => {
    const text = JSON.stringify(buildDirectorInput(prepared(), 41000, 0));
    expect(text).not.toContain('secret-user-id');
    expect(text).not.toMatch(/"(id|seed|email|name|displayName|student)":\s*"secret/);
    expect(text).not.toContain('"seed"');
  });

  it('has what AI_DIRECTOR §4.1 lists', () => {
    const input = buildDirectorInput(prepared(), 41000, 0);
    expect(input.trigger).toBe('after_attempt');
    expect(input.lastAttempt.result).toBe('misconception');
    expect(input.lastAttempt.timeSec).toBe(41);
    expect(input.interest).toBe('เกม');
    expect(input.candidates[0].scene).toBe('row_col_dot');
    expect(input.skills.length).toBeLessThanOrEqual(5);
    expect(input.allowedTokens).toContain('i');
  });

  it('gives the tutor its rules', () => {
    const prompt = systemPrompt();
    expect(prompt).toContain('ห้ามคำนวณ');
    expect(prompt).toContain('{{aCell}}');
    expect(prompt).not.toMatch(/qedify/i);
  });
});

describe('decideWithLlm', () => {
  it("fills the tutor's tokens with the engine's numbers", async () => {
    const provider = answering(
      decision({ message: 'ดูช่องแถว {{i}} หลัก {{j}} ที่มาจาก {{aCell}} นะ' }),
    );
    const result = await decideWithLlm(prepared(), options(provider));
    expect(result?.mode).toBe('llm');
    expect(result?.tutor.message).toMatch(/แถว 1 หลัก 1/);
    expect(result?.tutor.message).not.toContain('{{');
  });

  it('carries narration through to the chosen clip', async () => {
    const start = prepared();
    const beat = start.candidates[0].scene!.beats[0];
    const provider = answering(decision({ narration: [{ beat, text: 'ดูแถว {{i}} ก่อนนะ' }] }));
    const decided = await decideWithLlm(start, options(provider));
    const { turn } = commitAttempt({ ...start, mode: 'llm' }, decided?.choice, decided?.tutor);
    expect(turn.scenes[0].narration?.[beat]).toBe('ดูแถว 1 ก่อนนะ');
  });

  it('falls back with a reason on bad output', async () => {
    const result = await decideWithLlm(prepared(), options(answering('oops')));
    expect(result?.choice).toBeUndefined();
    expect(result?.tutor.fallbackReason).toBe('schema_invalid');
  });

  it('falls back on a provider error, and says why in the server log', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const provider: LlmProvider = {
      completeJson: async () => {
        throw new Error('500');
      },
    };
    const result = await decideWithLlm(prepared(), options(provider));
    expect(result?.tutor.fallbackReason).toBe('provider_error');
    expect(log).toHaveBeenCalledWith('tutor: 500');
    log.mockRestore();
  });

  it('falls back on a 429', async () => {
    const provider: LlmProvider = {
      completeJson: async () => {
        throw new RateLimitedError();
      },
    };
    const result = await decideWithLlm(prepared(), options(provider));
    expect(result?.tutor.fallbackReason).toBe('rate_limited');
  });

  it('gives up at the time limit, however long the provider would take', async () => {
    const provider: LlmProvider = {
      completeJson: ({ signal }) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    };
    const result = await decideWithLlm(prepared(), { ...options(provider), timeoutMs: 5 });
    expect(result?.tutor.fallbackReason).toBe('timeout');
  });
});

describe('llmDecider', () => {
  const store = (calls = 0) => ({ llmCallsSince: async () => calls });

  it('is off with no provider set, so the rules decide with nothing asked of anyone', () => {
    expect(llmDecider({ userId: 'u', store: store(), config: null })).toBeNull();
  });

  it('holds back a student who has used up this minute', async () => {
    const decide = llmDecider({
      userId: 'u',
      store: store(20),
      config: { model: 'm', apiKey: 'k', timeoutMs: 100 },
      provider: answering(decision()),
    })!;
    const result = await decide(prepared(), { timeMs: 1, hintLevel: 0 });
    expect(result?.tutor.fallbackReason).toBe('rate_limited');
  });

  it('asks when there is room', async () => {
    const decide = llmDecider({
      userId: 'u',
      store: store(0),
      config: { model: 'm', apiKey: 'k', timeoutMs: 100 },
      provider: answering(decision()),
    })!;
    expect((await decide(prepared(), { timeMs: 1, hintLevel: 0 }))?.mode).toBe('llm');
  });
});

describe('llmConfig', () => {
  it('is off by default, and off without a key', () => {
    expect(llmConfig({})).toBeNull();
    expect(llmConfig({ LLM_PROVIDER: 'none', LLM_API_KEY: 'k' })).toBeNull();
    expect(llmConfig({ LLM_PROVIDER: 'anthropic' })).toBeNull();
    expect(llmConfig({ LLM_PROVIDER: 'gemini', LLM_API_KEY: 'k' })).toBeNull();
  });
  it('reads what is set, with a fast model and the 4 s limit by default', () => {
    const config = llmConfig({ LLM_PROVIDER: 'anthropic', LLM_API_KEY: 'k' });
    expect(config?.model).toBe('claude-haiku-5-5');
    expect(config?.timeoutMs).toBe(4000);
    expect(
      llmConfig({
        LLM_PROVIDER: 'anthropic',
        LLM_API_KEY: 'k',
        LLM_MODEL: 'x',
        LLM_TIMEOUT_MS: '900',
      }),
    ).toMatchObject({ model: 'x', timeoutMs: 900 });
  });
});
