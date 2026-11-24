import type { Rng } from '@/lib/core/prng';
import { isParallel, vec } from '../ops';
import { solve } from '../solve';
import type { ItemBody, SkillGenerator, VectorData } from '../types';
import { drawUntil, drawVec, negative, range, wrongForm, zeroCount } from './sample';

/** L1: at least two zeros among the six components, so the expansion is short. */
function withZeros(rng: Rng): VectorData {
  return drawUntil(
    () => {
      const parts = Array.from({ length: 6 }, () => rng.int(1, 5));
      for (const index of rng.sample(range(0, 5), rng.int(2, 3))) parts[index] = 0;
      return {
        form: 'cross',
        u: vec(...parts.slice(0, 3)),
        v: vec(...parts.slice(3)),
        order: 'uv',
      } as const;
    },
    ({ u, v }) => !isParallel(u, v) && zeroCount(u) < 3 && zeroCount(v) < 3,
  );
}

function general(rng: Rng, order: 'uv' | 'vu'): VectorData {
  return drawUntil(
    () =>
      ({
        form: 'cross',
        u: drawVec(rng, 3, range(-6, 6)),
        v: drawVec(rng, 3, range(-6, 6)),
        order,
      }) as const,
    ({ u, v }) => !isParallel(u, v) && negative([...u, ...v]) && zeroCount([...u, ...v]) <= 1,
  );
}

export const cross: SkillGenerator = {
  sample(rng, level) {
    if (level === 1) return withZeros(rng);
    return general(rng, level === 3 ? 'vu' : 'uv');
  },

  body(data): ItemBody {
    if (data.form !== 'cross') throw wrongForm('v_cross', data.form);
    return {
      kind: 'vector',
      prompt: { key: data.order === 'uv' ? 'cross_uv' : 'cross_vu' },
      data,
      grid: { rows: 3, cols: 1 },
      correct: solve(data),
    };
  },
};
