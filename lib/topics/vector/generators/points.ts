import type { Rng } from '@/lib/core/prng';
import { add, isParallel, sub, vec } from '../ops';
import { solve } from '../solve';
import type { ItemBody, SkillGenerator, Vec, VectorData } from '../types';
import { drawUntil, negative, range, wrongForm, zeroCount } from './sample';

const inRange = (v: Vec, limit = 9) => v.every((part) => Math.abs(part.n) <= limit);

/** L1: A and B in 0..9 with no coordinate shared, so AB has two non-zero components. */
function plane(rng: Rng): VectorData {
  const A = vec(rng.int(0, 9), rng.int(0, 9));
  const B = vec(...A.map((part) => rng.pick(range(0, 9).filter((value) => value !== part.n))));
  return { form: 'points', A, B };
}

/** L2: 3D with negatives, and AB within −6..6 with at least two non-zero components. */
function space(rng: Rng): VectorData {
  return drawUntil(
    () => {
      const A = vec(rng.int(-6, 6), rng.int(-6, 6), rng.int(-6, 6));
      const B = add(A, vec(rng.int(-6, 6), rng.int(-6, 6), rng.int(-6, 6)));
      return { form: 'points', A, B } as const;
    },
    ({ A, B }) => inRange(B) && zeroCount(sub(B, A)) <= 1 && negative([...A, ...B]),
  );
}

/** L3: three vertices of ABCD in space; D = A + C − B. */
function fourthVertex(rng: Rng): VectorData {
  return drawUntil(
    () => {
      const point = () => vec(rng.int(-6, 6), rng.int(-6, 6), rng.int(-6, 6));
      return { form: 'fourth_vertex', A: point(), B: point(), C: point() } as const;
    },
    ({ A, B, C }) => inRange(sub(add(A, C), B)) && !isParallel(sub(B, A), sub(C, B)),
  );
}

export const points: SkillGenerator = {
  sample(rng, level) {
    if (level === 1) return plane(rng);
    return level === 2 ? space(rng) : fourthVertex(rng);
  },

  body(data): ItemBody {
    switch (data.form) {
      case 'points':
        return {
          kind: 'vector',
          prompt: { key: 'points_find' },
          data,
          grid: { rows: data.A.length, cols: 1 },
          correct: solve(data),
        };
      case 'fourth_vertex':
        return {
          kind: 'vector',
          prompt: { key: 'fourth_vertex' },
          data,
          grid: { rows: 3, cols: 1 },
          correct: solve(data),
        };
      default:
        throw wrongForm('v_points', data.form);
    }
  },
};
