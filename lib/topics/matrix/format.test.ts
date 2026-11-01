import { describe, expect, it } from 'vitest';
import { Rational } from '@/lib/core/rational';
import { factorText, givenMatrices, rationalText } from './format';
import { generate } from './generators';
import { SKILLS, levelsOf } from './skills';

describe('numbers in copy', () => {
  it('rationalText uses a typographic minus', () => {
    expect(rationalText(Rational.of(-3, 2))).toBe('−3/2');
    expect(rationalText(Rational.of(7))).toBe('7');
  });

  it('factorText brackets a negative factor, as on paper', () => {
    expect(factorText(Rational.of(-2))).toBe('(−2)');
    expect(factorText(Rational.of(2))).toBe('2');
    expect(factorText(Rational.ZERO)).toBe('0');
  });
});

describe('givenMatrices', () => {
  it('shows every matrix an item holds, so a new form cannot silently hide one', () => {
    for (const { id } of SKILLS) {
      for (const difficulty of levelsOf(id)) {
        for (let seed = 0; seed < 50; seed += 1) {
          const { data } = generate({ skill: id, difficulty, seed });
          const held = Object.keys(data).filter((key) => /^(A|B|AB)$/.test(key));
          expect(givenMatrices(data).map(({ label }) => label)).toEqual(held);
        }
      }
    }
  });
});
