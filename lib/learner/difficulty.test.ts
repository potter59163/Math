import { describe, expect, it } from 'vitest';
import type { Level } from '@/lib/core/types';
import { nextLevel, rollingRate } from './difficulty';
import type { FirstAttempt } from './types';

const attempt = (level: Level, countsCorrect: boolean): FirstAttempt => ({
  level,
  countsCorrect,
  clean: countsCorrect,
  timeMs: 1000,
});

const right = (level: Level) => attempt(level, true);
const wrong = (level: Level) => attempt(level, false);

const LOW_P = 0.5;

describe('rollingRate (SPEC §7.3)', () => {
  it('reads the last six first attempts', () => {
    const attempts = [
      wrong(1),
      wrong(1),
      right(1),
      right(1),
      right(1),
      right(1),
      right(1),
      right(1),
    ];
    expect(rollingRate(attempts)).toBe(1);
    expect(rollingRate(attempts.slice(0, 7))).toBeCloseTo(5 / 6);
  });

  it('uses whatever there is before six', () => {
    expect(rollingRate([right(1), wrong(1)])).toBe(0.5);
  });

  it('is 0 with nothing to read', () => {
    expect(rollingRate([])).toBe(0);
  });
});

describe('nextLevel (SPEC §7.3)', () => {
  describe('going up', () => {
    it('needs two attempts at this level as well as a high rate', () => {
      expect(nextLevel(1, [right(1)], LOW_P, 3)).toBe(1);
      expect(nextLevel(1, [right(1), right(1)], LOW_P, 3)).toBe(2);
    });

    it('counts attempts at this level only', () => {
      expect(nextLevel(2, [right(1), right(1), right(2)], LOW_P, 3)).toBe(2);
      expect(nextLevel(2, [right(1), right(1), right(2), right(2)], LOW_P, 3)).toBe(3);
    });

    it('from L1 also happens at P(L) ≥ 0.95, whatever the rate', () => {
      const attempts = [wrong(1), right(1), right(1)];
      expect(nextLevel(1, attempts, 0.9, 3)).toBe(1);
      expect(nextLevel(1, attempts, 0.95, 3)).toBe(2);
    });

    it('does not use P(L) above L1', () => {
      expect(nextLevel(2, [wrong(2), right(2)], 0.99, 3)).toBe(2);
    });

    it('stops at maxLevel', () => {
      expect(nextLevel(2, [right(2), right(2)], LOW_P, 2)).toBe(2);
      expect(nextLevel(3, [right(3), right(3)], LOW_P, 3)).toBe(3);
    });

    it('needs the latest answer to be right', () => {
      const attempts = [right(1), right(1), right(1), right(1), right(1), right(1), wrong(1)];
      expect(rollingRate(attempts)).toBeCloseTo(5 / 6);
      expect(nextLevel(1, attempts, 0.99, 3)).toBe(1);
    });

    it('needs 85%, so one wrong in the window holds it back', () => {
      const attempts = [wrong(2), right(2), right(2), right(2), right(2), right(2)];
      expect(rollingRate(attempts)).toBeCloseTo(5 / 6);
      expect(nextLevel(2, attempts, 0.99, 3)).toBe(2);
    });
  });

  describe('going down', () => {
    it('happens at a rate of 50% or less after a wrong answer', () => {
      expect(nextLevel(2, [right(1), wrong(2)], LOW_P, 3)).toBe(1);
      expect(nextLevel(2, [wrong(2)], LOW_P, 3)).toBe(1);
    });

    it('not above 50%', () => {
      expect(nextLevel(2, [right(1), right(1), wrong(2)], LOW_P, 3)).toBe(2);
    });

    it('stops at L1', () => {
      expect(nextLevel(1, [wrong(1), wrong(1)], LOW_P, 3)).toBe(1);
    });

    it('needs the latest answer to be wrong', () => {
      expect(nextLevel(2, [wrong(2), wrong(2), right(2)], LOW_P, 3)).toBe(2);
    });
  });

  it('moves at most one level at a time', () => {
    const attempts = [right(1), right(1), right(1), right(1)];
    expect(nextLevel(1, attempts, 0.99, 3)).toBe(2);
  });
});
