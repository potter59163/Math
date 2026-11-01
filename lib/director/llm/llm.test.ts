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
  ])('refuses %s', (_name, text, reason) => {
    const result = check(text, candidates);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe(reason);
  });

  describe('a line of narration that fails', () => {
    const good = { beat, text: 'ดูแถว {{i}}' };
    const kept = (narration: object[]) => {
      const result = check(decision({ narration }), candidates);
      expect(result.ok).toBe(true);
      return result.ok ? result.decision.narration : null;
    };

    it.each([
      ['a beat not in the clip', { beat: 'nope', text: 'ดูแถวนี้' }],
      ['a digit', { beat, text: 'ได้ 5' }],
      ['a number in words', { beat, text: 'อีกสองช่อง' }],
      ['a token not allowed', { beat, text: 'ได้ {{det}}' }],
      ['a stray brace', { beat, text: 'ได้ {i}' }],
      ['too long', { beat, text: 'ก'.repeat(71) }],
      ['nothing in it', { beat, text: '' }],
    ])('with %s costs only that line, and never reaches a student', (_name, line) => {
      expect(kept([good, line])).toEqual([good]);
    });

    it('leaves no narration at all when no line survives', () => {
      expect(kept([{ beat, text: 'ได้ 5' }])).toBeUndefined();
    });

    it('is dropped when the chosen way has no clip to narrate', () => {
      const noClip = candidates.map((candidate) => ({ ...candidate, scene: undefined }));
      const result = check(decision({ narration: [good] }), noClip);
      expect(result.ok && result.decision.narration).toBeUndefined();
    });

    it('stops at the most lines a clip can use', () => {
      expect(kept(Array.from({ length: 9 }, () => good))).toHaveLength(6);
    });

    it('refuses a revealing token only while the item is open', () => {
      const line = { beat, text: 'คือ {{correctCell}}' };
      const open = check(decision({ narration: [line] }), candidates, false);
      expect(open.ok && open.decision.narration).toBeUndefined();
    });
  });

  describe('a size written out', () => {
    const withSizes = (message: string) =>
      validateDecision({
        text: decision({ message }),
        candidates,
        allowedTokens: ['dimsA', 'dimsB'],
        revealAllowed: true,
        sizes: { dimsA: '3×3', dimsB: '2×4' },
      });

    it.each([
      ['det 3×3 ถูกแล้วนะ', 'det {{dimsA}} ถูกแล้วนะ'],
      ['det 3 × 3 ถูกแล้วนะ', 'det {{dimsA}} ถูกแล้วนะ'],
      ['det 3x3 ถูกแล้วนะ', 'det {{dimsA}} ถูกแล้วนะ'],
      ['B เป็น 2×4 นะ', 'B เป็น {{dimsB}} นะ'],
    ])('%s becomes the token, so the number is the engine’s', (written, message) => {
      const result = withSizes(written);
      expect(result.ok && result.decision.message).toBe(message);
    });

    it('is still refused when it is not the size of this item', () => {
      expect(withSizes('det 2×2 ถูกแล้วนะ')).toEqual({ ok: false, reason: 'digit_violation' });
    });

    it('is still refused when the engine gave no sizes', () => {
      expect(check(decision({ message: 'det 3×3 นะ' }), candidates)).toEqual({
        ok: false,
        reason: 'digit_violation',
      });
    });
  });

  it('trims a reason too long, which only the log sees, rather than losing the answer', () => {
    const result = check(decision({ reason: 'ก'.repeat(500) }), candidates);
    expect(result.ok && result.decision.reason).toHaveLength(200);
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
  it.each([
    'สามารถทำได้',
    'ห้ามลืม',
    'เรียบร้อยแล้ว',
    'ความสัมพันธ์',
    'ก้าวหน้า',
    'ลองอีกข้อนะ',
    'พลาดไปนิดหนึ่ง',
    'รอสักครู่หนึ่ง',
    'รูปสามเหลี่ยม',
    'รูปสี่เหลี่ยม',
  ])('leaves %s alone, which only looks like a number', (text) => {
    expect(hasNumberInWords(text)).toBe(false);
  });
});

describe('what the tutor is told', () => {
  it('gives skills and levels no numbers, which the tutor would copy into its words', () => {
    const item = generate({ skill: 'det2', difficulty: 1, seed: 7 });
    const student = newProfile({ id: 'u', units: [1, 2, 3, 4, 5] });
    const attempt = { item, answer: item.correct, hintLevel: 0 as const, timeMs: 1, at: AT };
    const input = buildDirectorInput(prepareAttempt(student, attempt), 1, 0);
    expect(input.lastAttempt).toMatchObject({ skill: 'det_small', level: 'ง่าย' });
    const told = input.skills.flatMap(({ id, nameTh, level }) => [id, nameTh, level]);
    const next = input.candidates.flatMap(({ next: { skill, level } }) => [skill, level]);
    expect([...told, ...next].join()).not.toMatch(/[0-9]/);
  });

  it('says how fast in words, and which matrices the item has', () => {
    const inputFor = (skill: 'dim' | 'mult', timeMs: number) => {
      const item = generate({ skill, difficulty: 1, seed: 7 });
      const student = newProfile({ id: 'u', units: [1, 2, 3, 4, 5] });
      const attempt = { item, answer: item.correct, hintLevel: 0 as const, timeMs, at: AT };
      return buildDirectorInput(prepareAttempt(student, attempt), timeMs, 0).lastAttempt;
    };
    expect(inputFor('dim', 5_000)).toMatchObject({ speed: 'เร็ว', matrices: ['A'] });
    expect(inputFor('mult', 200_000)).toMatchObject({ speed: 'ช้า', matrices: ['A', 'B'] });
  });

  it('never calls the clip for a 2×2 by the name of the rule for a 3×3', () => {
    const item = generate({ skill: 'det2', difficulty: 1, seed: 7, target: 'M12_DET2_FORMULA' });
    const student = newProfile({ id: 'u', units: [1, 2, 3, 4, 5] });
    const answer = misconceptionAnswer(item, 'M12_DET2_FORMULA')!;
    const attempt = { item, answer, hintLevel: 0 as const, timeMs: 1, at: AT };
    const input = buildDirectorInput(prepareAttempt(student, attempt), 1, 0);
    expect(input.candidates[0].scene).toBe('det_diagonals');
    expect(JSON.stringify(input)).not.toMatch(/sarrus/i);
  });

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
    expect(input.lastAttempt.speed).toBe('ปกติ');
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
