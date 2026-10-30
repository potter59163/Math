import { describe, expect, it } from 'vitest';
import { CONFIG } from '@/lib/config';

describe('CONFIG', () => {
  it('keeps BKT parameters as probabilities', () => {
    const probabilities = [
      ...Object.values(CONFIG.bkt),
      ...Object.values(CONFIG.bktFromPretest),
      CONFIG.mastery.pKnown,
    ];
    for (const p of probabilities) {
      expect(p).toBeGreaterThan(0);
      expect(p).toBeLessThan(1);
    }
  });

  it('keeps thresholds in a workable order', () => {
    expect(CONFIG.difficulty.upAt).toBeGreaterThan(CONFIG.difficulty.downAt);
    expect(CONFIG.mastery.minFirstTryCorrectIfPretestCorrect).toBeLessThanOrEqual(
      CONFIG.mastery.minFirstTryCorrect,
    );
    expect(CONFIG.bktFromPretest.correct).toBeGreaterThan(CONFIG.bktFromPretest.otherWrong);
    expect(CONFIG.bktFromPretest.otherWrong).toBeGreaterThan(CONFIG.bktFromPretest.misconception);
  });
});
