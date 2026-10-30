import { Rational } from '@/lib/core/rational';
import type { Rng } from '@/lib/core/prng';
import { signed } from '../format';
import { add, det2 } from '../ops';
import type { ItemBody, MatrixData, SkillGenerator } from '../types';
import { drawMatrix, nonZero, range, wrongForm } from './sample';

const SUM_POOL = range(-3, 4);

function detSum(rng: Rng): MatrixData {
  const dims = { rows: 2, cols: 2 };
  return {
    form: 'det_sum',
    A: drawMatrix(rng, dims, SUM_POOL),
    B: drawMatrix(rng, dims, SUM_POOL),
  };
}

function scaled(rng: Rng): MatrixData {
  return { form: 'det_scaled', n: 3, d: rng.pick(nonZero(5)), k: rng.pick([-3, -2, 2, 3]) };
}

export const detProps: SkillGenerator = {
  sample(rng, level, { target }) {
    if (level === 1) {
      return {
        form: 'det_scaled',
        n: 2,
        d: rng.pick(nonZero(6)),
        k: rng.pick([-3, -2, -1, 2, 3, 4, 5]),
      };
    }
    if (level === 2) {
      if (target === 'M14_DET_SCALAR_LINEAR') return scaled(rng);
      if (target === 'M15_DET_ADDITIVE') return detSum(rng);
      const form = rng.int(1, 3);
      if (form === 1) return scaled(rng);
      if (form === 2) return detSum(rng);
      return { form: 'det_product', p: rng.pick(nonZero(7)), q: rng.pick(nonZero(7)) };
    }
    return rng.chance(1, 2)
      ? { form: 'det_transpose', d: rng.pick(nonZero(9)) }
      : { form: 'det_inverse', d: rng.pick([...range(-12, -2), ...range(2, 12)]) };
  },

  body(data): ItemBody {
    switch (data.form) {
      case 'det_scaled': {
        const { n, d, k } = data;
        return {
          kind: 'scalar',
          prompt: {
            key: 'det_scaled',
            // Written det(−A), never det(−1A).
            params: { n: String(n), d: signed(d), k: k === -1 ? '−' : signed(k) },
          },
          data,
          correct: { kind: 'scalar', value: Rational.of(k).pow(n).mul(Rational.of(d)) },
        };
      }
      case 'det_product':
        return {
          kind: 'scalar',
          prompt: { key: 'det_product', params: { p: signed(data.p), q: signed(data.q) } },
          data,
          correct: { kind: 'scalar', value: Rational.of(data.p).mul(Rational.of(data.q)) },
        };
      case 'det_sum':
        return {
          kind: 'scalar',
          prompt: { key: 'det_sum' },
          data,
          correct: { kind: 'scalar', value: det2(add(data.A, data.B)) },
        };
      case 'det_transpose':
        return {
          kind: 'scalar',
          prompt: { key: 'det_transpose', params: { d: signed(data.d) } },
          data,
          correct: { kind: 'scalar', value: Rational.of(data.d) },
        };
      case 'det_inverse':
        return {
          kind: 'scalar',
          prompt: { key: 'det_inverse', params: { d: signed(data.d) } },
          data,
          correct: { kind: 'scalar', value: Rational.of(1, data.d) },
        };
      default:
        throw wrongForm('det_props', data.form);
    }
  },
};
