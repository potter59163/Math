import type { Rng } from '@/lib/core/prng';
import { add, isParallel, vec } from '../ops';
import { solve, triangleSides } from '../solve';
import type { ItemBody, SkillGenerator, Vec, VectorData } from '../types';
import { drawUntil, drawVec, range, wrongForm } from './sample';

const SIDE = range(-3, 3);
const within = (v: Vec, limit: number) => v.every((part) => Math.abs(part.n) <= limit);

function parallelogramSides(rng: Rng): VectorData {
  return drawUntil(
    () =>
      ({ form: 'area_parallelogram', u: drawVec(rng, 3, SIDE), v: drawVec(rng, 3, SIDE) }) as const,
    ({ u, v }) => !isParallel(u, v),
  );
}

/** L2 in space, L3 in the xy-plane, where the area is ½|ad − bc| as with a 2×2 det. */
function triangle(rng: Rng, flat: boolean): VectorData {
  return drawUntil(
    () => {
      const point = (z: () => number) => vec(rng.int(-5, 5), rng.int(-5, 5), z());
      const A = point(() => (flat ? 0 : rng.int(-5, 5)));
      const side = () => (flat ? vec(rng.int(-6, 6), rng.int(-6, 6), 0) : drawVec(rng, 3, SIDE));
      return { form: 'area_triangle', A, B: add(A, side()), C: add(A, side()) } as const;
    },
    (data) => {
      const flatNow = [data.A, data.B, data.C].every((p) => p[2].isZero());
      return (
        within(data.B, 9) &&
        within(data.C, 9) &&
        flatNow === flat &&
        !isParallel(...triangleSides(data))
      );
    },
  );
}

export const area: SkillGenerator = {
  sample(rng, level) {
    if (level === 1) return parallelogramSides(rng);
    return triangle(rng, level === 3);
  },

  body(data): ItemBody {
    switch (data.form) {
      case 'area_parallelogram':
        return {
          kind: 'surd',
          prompt: { key: 'area_parallelogram' },
          data,
          correct: solve(data),
        };
      case 'area_triangle':
        return { kind: 'surd', prompt: { key: 'area_triangle' }, data, correct: solve(data) };
      default:
        throw wrongForm('v_area', data.form);
    }
  },
};
