import { describe, expect, it } from 'vitest';
import type { Level } from '@/lib/core/types';
import { meetsMastery } from './mastery';
import type { FirstAttempt, SkillState } from './types';

const attempt = (level: Level, countsCorrect: boolean, isClean: boolean): FirstAttempt => ({
  level,
  countsCorrect,
  clean: isClean,
  timeMs: 1000,
});
const clean = (level: Level) => attempt(level, true, true);
const wrong = (level: Level) => attempt(level, false, false);
const withL1Hint = (level: Level) => attempt(level, true, false);

function state(attempts: FirstAttempt[], extra: Partial<SkillState> = {}): SkillState {
  return {
    pKnown: 0.99,
    level: 2,
    attempts,
    passed: false,
    wrongStreak: 0,
    stuck: false,
    lastSeen: attempts.length,
    ...extra,
  };
}

describe('meetsMastery (SPEC §7.1)', () => {
  it('holds with three clean answers, one at L2, and P(L) ≥ 0.95', () => {
    expect(meetsMastery(state([clean(1), clean(1), clean(2)]), false)).toBe(true);
  });

  it('1. needs P(L) ≥ 0.95', () => {
    expect(meetsMastery(state([clean(1), clean(1), clean(2)], { pKnown: 0.94 }), false)).toBe(
      false,
    );
  });

  it('2. needs a third clean answer even when P(L) passed 0.95 at the second', () => {
    expect(meetsMastery(state([clean(1), clean(2)]), false)).toBe(false);
  });

  it('2. does not count an answer helped by a hint', () => {
    const attempts = [clean(1), withL1Hint(1), clean(2)];
    expect(meetsMastery(state(attempts), false)).toBe(false);
    expect(meetsMastery(state([...attempts, clean(2)]), false)).toBe(true);
  });

  it('3. needs one of the clean answers at L2 or above, however many at L1', () => {
    expect(meetsMastery(state([clean(1), clean(1), clean(1), clean(1)]), false)).toBe(false);
  });

  it('3. does not count a helped answer at L2', () => {
    const attempts = [clean(1), clean(1), clean(1), withL1Hint(2)];
    expect(meetsMastery(state(attempts), false)).toBe(false);
  });

  it('3. L3 counts too', () => {
    expect(meetsMastery(state([clean(1), clean(1), clean(3)]), false)).toBe(true);
  });

  it('4. needs no suspected or active misconception', () => {
    expect(meetsMastery(state([clean(1), clean(1), clean(2)]), true)).toBe(false);
  });
});

describe('fast pass for a skill right on the pre-test (SPEC §7.1)', () => {
  const fast = { pretestCorrect: true };

  it('one clean answer at L2 is enough', () => {
    expect(meetsMastery(state([clean(2)], fast), false)).toBe(true);
  });

  it('still needs P(L) ≥ 0.95, which a two-way choice takes four answers to reach', () => {
    expect(meetsMastery(state([clean(2)], { ...fast, pKnown: 0.77 }), false)).toBe(false);
  });

  it('still needs that answer to be clean', () => {
    expect(meetsMastery(state([withL1Hint(2)], fast), false)).toBe(false);
  });

  it('still needs L2 or above', () => {
    expect(meetsMastery(state([clean(1)], fast), false)).toBe(false);
  });

  it('ends at the first wrong answer, which goes back to the normal rule', () => {
    const attempts = [wrong(2), clean(1), clean(2)];
    expect(meetsMastery(state(attempts, fast), false)).toBe(false);
    expect(meetsMastery(state([...attempts, clean(2)], fast), false)).toBe(true);
  });
});
