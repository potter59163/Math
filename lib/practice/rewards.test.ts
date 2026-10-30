import { describe, expect, it } from 'vitest';
import { CONFIG } from '@/lib/config';
import { comboAfter, xpFor } from './rewards';

describe('xpFor (SPEC §11)', () => {
  it('pays 10 with no hint, 7 after L1 and 3 after L2 or L3', () => {
    expect(xpFor(true, 0)).toBe(10);
    expect(xpFor(true, 1)).toBe(7);
    expect(xpFor(true, 2)).toBe(3);
    expect(xpFor(true, 3)).toBe(3);
  });

  it('pays nothing for a wrong answer, whatever the hints', () => {
    for (const level of [0, 1, 2, 3] as const) expect(xpFor(false, level)).toBe(0);
  });

  it('takes its numbers from CONFIG', () => {
    expect(xpFor(true, 0)).toBe(CONFIG.xp.firstTry);
    expect(xpFor(true, 1)).toBe(CONFIG.xp.withL1Hint);
    expect(xpFor(true, 2)).toBe(CONFIG.xp.withDeepHint);
  });
});

describe('comboAfter (SPEC §11)', () => {
  it('grows on a correct answer with at most an L1 hint', () => {
    expect(comboAfter(4, true, 0)).toBe(5);
    expect(comboAfter(4, true, 1)).toBe(5);
  });

  it('holds on a correct answer after L2 or L3', () => {
    expect(comboAfter(4, true, 2)).toBe(4);
    expect(comboAfter(4, true, 3)).toBe(4);
  });

  it('resets on a wrong answer', () => {
    expect(comboAfter(4, false, 0)).toBe(0);
    expect(comboAfter(4, false, 3)).toBe(0);
  });
});
