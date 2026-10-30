import type { PromptKey } from '@/lib/content/th';
import { Rational } from '@/lib/core/rational';
import type { Rng } from '@/lib/core/prng';
import type { Matrix } from '@/lib/core/types';
import { add, equals, identity, mul, scalar } from '../ops';
import { NONCOMM_STATEMENT_IS_TRUE, type NoncommStatement, type SkillGenerator } from '../types';
import { asymmetricSquare, range, wrongForm } from './sample';

const STATEMENT_PROMPT: Record<NoncommStatement, PromptKey> = {
  always_equal: 'noncomm_always_equal',
  may_differ: 'noncomm_may_differ',
  swap_keeps_product: 'noncomm_swap_keeps_product',
};

const L2_POOL = range(-5, 5);
const L3_POOL = range(-4, 6);
const COMMUTING_POOL = range(-2, 3);

/** B = pA + qI always commutes with A, without looking like an obvious special case. */
function commutingPair(rng: Rng): { A: Matrix; B: Matrix } {
  const A = asymmetricSquare(rng, COMMUTING_POOL);
  const p = rng.pick([-1, 1, 2]);
  const q = rng.pick([-2, -1, 1, 2]);
  return { A, B: add(scalar(Rational.of(p), A), scalar(Rational.of(q), identity(2))) };
}

export const multNoncomm: SkillGenerator = {
  sample(rng, level, { target }) {
    if (level === 1) {
      return {
        form: 'noncomm_statement',
        statement: rng.pick(Object.keys(STATEMENT_PROMPT) as NoncommStatement[]),
      };
    }
    if (level === 2) {
      const A = asymmetricSquare(rng, L2_POOL);
      const B = asymmetricSquare(rng, L2_POOL);
      return { form: 'noncomm_find_ba', A, B, AB: mul(A, B) };
    }
    if (target === undefined && rng.chance(1, 3)) {
      return { form: 'noncomm_pair', ...commutingPair(rng) };
    }
    return {
      form: 'noncomm_pair',
      A: asymmetricSquare(rng, L3_POOL),
      B: asymmetricSquare(rng, L3_POOL),
    };
  },

  body(data) {
    switch (data.form) {
      case 'noncomm_statement':
        return {
          kind: 'choice',
          prompt: { key: STATEMENT_PROMPT[data.statement] },
          data,
          options: [
            { id: 'true', labelKey: 'true' },
            { id: 'false', labelKey: 'false' },
          ],
          correct: {
            kind: 'choice',
            id: NONCOMM_STATEMENT_IS_TRUE[data.statement] ? 'true' : 'false',
          },
        };
      case 'noncomm_find_ba':
        return {
          kind: 'matrix',
          prompt: { key: 'noncomm_find_ba' },
          data,
          grid: { rows: 2, cols: 2 },
          correct: { kind: 'matrix', value: mul(data.B, data.A) },
        };
      case 'noncomm_pair':
        return {
          kind: 'choice',
          prompt: { key: 'noncomm_pair' },
          data,
          options: [
            { id: 'swap_yes', labelKey: 'swap_yes' },
            { id: 'swap_no', labelKey: 'swap_no' },
          ],
          correct: {
            kind: 'choice',
            id: equals(mul(data.A, data.B), mul(data.B, data.A)) ? 'swap_yes' : 'swap_no',
          },
        };
      default:
        throw wrongForm('mult_noncomm', data.form);
    }
  },
};
