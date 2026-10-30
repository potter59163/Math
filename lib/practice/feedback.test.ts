import { describe, expect, it } from 'vitest';
import { CATALOG, variantsOf } from '@/lib/topics/matrix/misconceptions';
import { feedbackFor, misconceptionMessage } from './feedback';

describe('feedbackFor (SPEC §9)', () => {
  it('praises a correct answer and offers no solution', () => {
    expect(feedbackFor({ type: 'correct' })).toEqual({
      tone: 'correct',
      headline: 'ถูกต้อง!',
      offersWorked: false,
    });
  });

  it('names the cell of a slip without the right value', () => {
    expect(feedbackFor({ type: 'slip', cell: [2, 1] })).toEqual({
      tone: 'wrong',
      headline: 'เกือบแล้ว',
      detail: 'ผิดแค่ช่องแถว 2 หลัก 1',
      offersWorked: true,
    });
  });

  it.each(['shape_error', 'unknown'] as const)('walks through the solution after %s', (type) => {
    expect(feedbackFor({ type })).toEqual({
      tone: 'wrong',
      headline: 'ยังไม่ถูก',
      detail: 'มาดูทีละขั้นกัน',
      offersWorked: true,
    });
  });

  it('gives the message of the misconception', () => {
    const result = feedbackFor({ type: 'misconception', id: 'M09_MULT_ELEMENTWISE' });
    expect(result.tone).toBe('wrong');
    expect(result.offersWorked).toBe(true);
    expect(result.detail).toBe(misconceptionMessage('M09_MULT_ELEMENTWISE'));
  });

  it('tells two variants apart', () => {
    const noSwap = feedbackFor({
      type: 'misconception',
      id: 'M20_INV2_RECIPE',
      variant: 'NO_SWAP',
    });
    const noDivide = feedbackFor({
      type: 'misconception',
      id: 'M20_INV2_RECIPE',
      variant: 'NO_DIVIDE',
    });
    expect(noSwap.detail).not.toBe(noDivide.detail);
  });
});

describe('misconceptionMessage', () => {
  it('has text for every misconception and every variant', () => {
    for (const { id } of CATALOG) {
      for (const variant of variantsOf(id)) {
        expect(misconceptionMessage(id, variant).length).toBeGreaterThan(0);
      }
    }
  });

  it('fits the feedback card at 360px', () => {
    for (const { id } of CATALOG) {
      for (const variant of variantsOf(id)) {
        expect(misconceptionMessage(id, variant).length).toBeLessThanOrEqual(120);
      }
    }
  });

  it('never quotes a number from the item, so it cannot give the answer away', () => {
    // Only fixed facts of the topic may appear: 3 เส้น, 3×3, det เป็น 0, เลข 0.
    const allowed = /\d+ เส้น|\d×\d|เป็น 0|เลข 0/g;
    for (const { id } of CATALOG) {
      for (const variant of variantsOf(id)) {
        expect(misconceptionMessage(id, variant).replace(allowed, '')).not.toMatch(/[0-9๐-๙]/);
      }
    }
  });

  it('falls back to the L2 hint for an unknown variant rather than showing a blank', () => {
    expect(misconceptionMessage('M20_INV2_RECIPE', 'NOT_A_VARIANT').length).toBeGreaterThan(0);
  });
});
