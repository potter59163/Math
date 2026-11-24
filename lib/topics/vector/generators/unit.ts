import { signed } from '../format';
import { norm, vec } from '../ops';
import { limitProblem } from '../rules';
import { solve } from '../solve';
import type { ItemBody, SkillGenerator, Vec } from '../types';
import { allVectors, lazy, wrongForm, zeroCount } from './sample';

/**
 * Vectors with at least two non-zero components: with only one, v/|v|² and v/|v| differ in one
 * component, which a slip would explain just as well (rule 3).
 */
function pool(size: 2 | 3, limit: number, wholeLength: boolean): Vec[] {
  return allVectors(size, -limit, limit)
    .map((parts) => vec(...parts))
    .filter((v) => zeroCount(v) <= size - 2)
    .filter((v) => norm(v).isRational() === wholeLength);
}

/** 2D with a whole length, such as (3, 4). Squares stay within 60, so this is (±3, ±4) and (±4, ±3). */
const PLANE = lazy(() => pool(2, 7, true));
/** 3D with a whole length, such as (1, 2, 2) or (2, −3, 6). */
const SPACE = lazy(() => pool(3, 7, true));
/** 3D whose length has a root, such as (1, −1, 2) with |v| = √6. */
const ROOTED = lazy(() =>
  pool(3, 5, false).filter((v) => limitProblem({ form: 'unit', v }) === null),
);

export const unit: SkillGenerator = {
  sample(rng, level) {
    if (level === 1) return { form: 'unit', v: rng.pick(PLANE()) };
    if (level === 2) return { form: 'unit', v: rng.pick(SPACE()) };
    const form = rng.pick(['unit', 'scaled_unit', 'direction_cosines'] as const);
    if (form === 'scaled_unit') {
      const v = rng.pick(rng.chance(1, 2) ? SPACE() : ROOTED());
      return { form, v, length: rng.int(2, 9) };
    }
    return { form, v: rng.pick(ROOTED()) };
  },

  body(data): ItemBody {
    switch (data.form) {
      case 'unit':
      case 'direction_cosines':
        return {
          kind: 'vector',
          prompt: { key: data.form === 'unit' ? 'unit_find' : 'direction_cosines' },
          data,
          grid: { rows: data.v.length, cols: 1 },
          correct: solve(data),
        };
      case 'scaled_unit':
        return {
          kind: 'vector',
          prompt: { key: 'scaled_unit', params: { length: signed(data.length) } },
          data,
          grid: { rows: 3, cols: 1 },
          correct: solve(data),
        };
      default:
        throw wrongForm('v_unit', data.form);
    }
  },
};
