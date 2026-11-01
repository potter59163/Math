import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { generate } from '@/lib/topics/matrix/generators';
import { guessRate, updateKnown } from './bkt';

const TYPED = 0.05;
const COIN = 0.5;

function chain(start: number, marks: boolean[], guess: number): string[] {
  let p = start;
  return marks.map((correct) => {
    p = updateKnown(p, correct, guess);
    return p.toFixed(3);
  });
}

describe('updateKnown (SPEC §7.1, worked examples)', () => {
  it('0.15 → right → 0.796 → right → 0.988', () => {
    expect(chain(0.15, [true, true], TYPED)).toEqual(['0.796', '0.988']);
  });

  it('0.60 → wrong → 0.266', () => {
    expect(chain(0.6, [false], TYPED)).toEqual(['0.266']);
  });

  it('a two-way choice from 0.15 → right → 0.355', () => {
    expect(chain(0.15, [true], COIN)).toEqual(['0.355']);
  });

  it('0.60 → right → 0.970, so a skill right on the pre-test can pass in one item', () => {
    expect(chain(0.6, [true], TYPED)).toEqual(['0.970']);
  });

  it('a two-way choice from 0.60 needs four right answers to reach 0.95', () => {
    let p = 0.6;
    for (let i = 0; i < 3; i += 1) p = updateKnown(p, true, COIN);
    expect(p).toBeLessThan(0.95);
    expect(updateKnown(p, true, COIN)).toBeGreaterThanOrEqual(0.95);
  });

  it('stays a probability, and a right answer never lowers it', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.001, max: 0.999, noNaN: true }),
        fc.constantFrom(TYPED, COIN, 1 / 3, 1 / 4),
        (p, guess) => {
          const right = updateKnown(p, true, guess);
          const wrong = updateKnown(p, false, guess);
          for (const value of [right, wrong]) {
            expect(value).toBeGreaterThan(0);
            expect(value).toBeLessThanOrEqual(1);
          }
          expect(right).toBeGreaterThanOrEqual(wrong);
        },
      ),
      { numRuns: 1000 },
    );
  });
});

describe('guessRate (SPEC §7.1)', () => {
  it('is 0.05 for a typed answer', () => {
    expect(guessRate(generate({ skill: 'mult', difficulty: 1, seed: 1 }))).toBe(TYPED);
    expect(guessRate(generate({ skill: 'det2', difficulty: 1, seed: 1 }))).toBe(TYPED);
    expect(guessRate(generate({ skill: 'dim', difficulty: 1, seed: 1 }))).toBe(TYPED);
  });

  it('is 1/k for a choice with k options', () => {
    expect(guessRate(generate({ skill: 'invertible', difficulty: 1, seed: 1 }))).toBe(COIN);
    expect(guessRate({ kind: 'choice', options: [1, 2, 3, 4].map(option) })).toBe(1 / 4);
  });
});

function option(id: number) {
  return { id: String(id), labelKey: String(id) };
}
