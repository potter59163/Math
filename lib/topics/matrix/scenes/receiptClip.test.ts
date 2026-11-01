import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { THEMES } from '@/lib/sync/types';
import type { ThemeId } from '@/lib/learner/types';
import { Rational } from '@/lib/core/rational';
import { generate } from '../generators';
import { matrix, mul } from '../ops';
import { RECEIPT_BEATS, receiptClip } from './receiptClip';

function caughtOn(seed: number, theme: ThemeId) {
  const item = generate({ skill: 'mult', difficulty: 1, seed, target: 'M09_MULT_ELEMENTWISE' });
  const wrong = item.diagnostics.find(({ id }) => id === 'M09_MULT_ELEMENTWISE');
  if (item.data.form !== 'mult' || wrong?.answer.kind !== 'matrix') throw new Error('not a catch');
  return receiptClip({
    left: item.data.A,
    right: item.data.B,
    student: wrong.answer.value,
    theme,
  });
}

describe('receiptClip', () => {
  const A = matrix([
    [1, 2],
    [1, 4],
  ]);
  const B = matrix([
    [4, 2],
    [3, 4],
  ]);
  const student = matrix([
    [4, 4],
    [3, 16],
  ]);
  const clip = receiptClip({ left: A, right: B, student, theme: 'game' })!;

  it('tells the story on the first cell they got wrong', () => {
    expect(clip.focus).toEqual([0, 0]);
    expect(clip.who).toBe('ผู้เล่น ก');
    expect(clip.lines.map(({ item }) => item)).toEqual(['ดาบ', 'โล่']);
  });

  it('works the receipt out with the engine: 1×4 + 2×3 = 10', () => {
    expect(clip.lines.map(({ amount }) => amount.n)).toEqual([4, 6]);
    expect(clip.total.equals(Rational.of(10))).toBe(true);
    expect(clip.product[0][0].equals(clip.total)).toBe(true);
  });

  it('has the student try a cell in another row: 1×4 + 4×3 = 16', () => {
    expect(clip.tryCell).toEqual([1, 0]);
    expect(clip.tryTotal.equals(Rational.of(16))).toBe(true);
  });

  it('says it in the student’s own numbers and theme', () => {
    expect(clip.captions.caught).toContain('4');
    expect(clip.captions.caught).toContain('10');
    expect(clip.captions.only_first).toContain('ดาบ');
    expect(clip.captions.only_first).toContain('โล่');
  });

  it('moves to the other row rather than count swords with a negative number', () => {
    const left = matrix([
      [-1, 2],
      [1, 4],
    ]);
    const answer = matrix([
      [-4, 4],
      [3, 16],
    ]);
    const made = receiptClip({ left, right: B, student: answer, theme: 'game' })!;
    expect(made.focus).toEqual([1, 1]);
    expect(made.who).toBe('ผู้เล่น ข');
    expect(made.total.equals(Rational.of(18))).toBe(true);
  });

  it('is not told at all when no row can be counted', () => {
    const left = matrix([
      [-1, 2],
      [1, -4],
    ]);
    const answer = matrix([
      [-4, 4],
      [3, -16],
    ]);
    expect(receiptClip({ left, right: B, student: answer, theme: 'game' })).toBeNull();
  });

  it('will not call it their line unless the answer really is that multiplication', () => {
    const notElementwise = matrix([
      [7, 4],
      [3, 9],
    ]);
    expect(receiptClip({ left: A, right: B, student: notElementwise, theme: 'game' })).toBeNull();
  });

  it('holds for every student this misconception can be caught on', () => {
    const themes = THEMES as readonly ThemeId[];
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1_000_000 }),
        fc.constantFrom(...themes),
        (seed, theme) => {
          const made = caughtOn(seed, theme);
          if (!made) return;
          const [row, col] = made.focus;
          const product = mul(made.left, made.right);

          // The story's total is the real answer, and the student's answer is really one line of it.
          expect(made.total.equals(product[row][col])).toBe(true);
          expect(made.lines[made.theirLine].amount.equals(made.student[row][col])).toBe(true);
          for (const { qty, price, amount } of made.lines) {
            expect(amount.equals(qty.mul(price))).toBe(true);
          }

          const [tryRow, tryCol] = made.tryCell;
          expect([tryRow, tryCol]).not.toEqual([row, col]);
          expect(made.tryTotal.equals(product[tryRow][tryCol])).toBe(true);

          for (const beat of RECEIPT_BEATS) expect(made.captions[beat]).not.toContain('{{');
        },
      ),
    );
  });

  it('can be told on nearly every student caught on the first level', () => {
    let told = 0;
    for (let seed = 1; seed <= 200; seed += 1) if (caughtOn(seed, 'game')) told += 1;
    expect(told).toBeGreaterThan(190);
  });
});
