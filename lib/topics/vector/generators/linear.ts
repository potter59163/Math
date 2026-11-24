import type { Rng } from '@/lib/core/prng';
import { linearExprText } from '../format';
import { solve } from '../solve';
import type { ItemBody, LinearTerm, SkillGenerator, VecName, VectorData } from '../types';
import { drawUntil, drawVec, negative, nonZero, range, wrongForm, zeroCount } from './sample';

const named = (k: number, name: VecName, size: 2 | 3, rng: Rng, pool: number[]): LinearTerm => ({
  k,
  name,
  vec: drawVec(rng, size, pool),
});

/**
 * L1: u + v in 2D, or ku. ku is 3D: in 2D, scaling only the first component (V06) changes a single
 * component, which a slip would explain just as well (rule 3).
 */
function first(rng: Rng, scaled: boolean): VectorData {
  if (scaled) {
    return {
      form: 'linear',
      terms: [named(rng.int(2, 5), 'u', 3, rng, range(1, 9))],
      notation: 'tuple',
    };
  }
  return {
    form: 'linear',
    terms: [named(1, 'u', 2, rng, range(0, 9)), named(1, 'v', 2, rng, range(0, 9))],
    notation: 'tuple',
  };
}

/** L2: pu − qv in 3D with negatives; v has no zero, so dropping the minus (V07) shows everywhere. */
function difference(rng: Rng): VectorData {
  return drawUntil(
    () =>
      ({
        form: 'linear',
        terms: [
          named(rng.int(2, 4), 'u', 3, rng, range(-6, 6)),
          named(-rng.int(2, 3), 'v', 3, rng, nonZero(6)),
        ],
        notation: 'tuple',
      }) as const,
    ({ terms }) => negative(terms.flatMap((t) => t.vec)) && zeroCount(terms[0].vec) <= 1,
  );
}

/** L3: pu − qv + rw, given as ai + bj + ck. */
function threeTerms(rng: Rng): VectorData {
  return drawUntil(
    () =>
      ({
        form: 'linear',
        terms: [
          named(rng.int(1, 3), 'u', 3, rng, range(-5, 5)),
          named(-rng.int(1, 3), 'v', 3, rng, nonZero(5)),
          named(rng.int(1, 3), 'w', 3, rng, range(-5, 5)),
        ],
        notation: 'ijk',
      }) as const,
    ({ terms }) =>
      terms.some((t) => Math.abs(t.k) >= 2) &&
      negative(terms.flatMap((t) => t.vec)) &&
      terms.every((t) => zeroCount(t.vec) <= 1),
  );
}

export const linear: SkillGenerator = {
  sample(rng, level, { target }) {
    if (level === 1) return first(rng, target === 'V06_SCALAR_PARTIAL' || rng.chance(1, 2));
    return level === 2 ? difference(rng) : threeTerms(rng);
  },

  body(data): ItemBody {
    if (data.form !== 'linear') throw wrongForm('v_linear', data.form);
    return {
      kind: 'vector',
      prompt: { key: 'linear_find', params: { expr: linearExprText(data.terms) } },
      data,
      grid: { rows: data.terms[0].vec.length, cols: 1 },
      correct: solve(data),
    };
  },
};
