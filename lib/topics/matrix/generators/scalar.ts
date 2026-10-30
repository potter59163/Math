import { Rational } from '@/lib/core/rational';
import { signed } from '../format';
import { scalar as scale, shape, sub } from '../ops';
import type { ItemBody, SkillGenerator } from '../types';
import { drawMatrix, matrixWithNegatives, nonZero, range, wrongForm } from './sample';

export const scalar: SkillGenerator = {
  sample(rng, level) {
    if (level === 1) {
      return {
        form: 'scalar',
        k: rng.pick([2, 3]),
        A: drawMatrix(rng, { rows: 2, cols: 2 }, range(1, 9)),
      };
    }
    if (level === 2) {
      const dims = rng.chance(1, 4) ? { rows: 2, cols: 3 } : { rows: 2, cols: 2 };
      return {
        form: 'scalar',
        k: rng.pick([-3, -2, 2, 3, 4]),
        // No zeros: k·0 = 0 would hide a skipped cell (MISCONCEPTIONS §2 rule 3).
        A: matrixWithNegatives(rng, dims, nonZero(9), 1),
      };
    }
    const [p, q] = rng.pick([
      [2, 3],
      [3, 2],
    ]);
    const dims = { rows: 2, cols: 2 };
    const pool = range(-5, 5);
    return { form: 'combo', p, q, A: drawMatrix(rng, dims, pool), B: drawMatrix(rng, dims, pool) };
  },

  body(data): ItemBody {
    if (data.form === 'scalar') {
      const { k, A } = data;
      return {
        kind: 'matrix',
        prompt: { key: 'scalar_find', params: { k: signed(k) } },
        data,
        grid: shape(A),
        correct: { kind: 'matrix', value: scale(Rational.of(k), A) },
      };
    }
    if (data.form === 'combo') {
      const { p, q, A, B } = data;
      return {
        kind: 'matrix',
        prompt: { key: 'combo_find', params: { p: signed(p), q: signed(q) } },
        data,
        grid: shape(A),
        correct: {
          kind: 'matrix',
          value: sub(scale(Rational.of(p), A), scale(Rational.of(q), B)),
        },
      };
    }
    throw wrongForm('scalar', data.form);
  },
};
