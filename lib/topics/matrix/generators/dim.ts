import type { Rng } from '@/lib/core/prng';
import type { Dims, Level } from '@/lib/core/types';
import { shape } from '../ops';
import type { SkillGenerator } from '../types';
import { drawMatrix, range, wrongForm } from './sample';

const SIZES = [2, 3, 4];

function sampleDims(rng: Rng, level: Level, needsSwapToDiffer: boolean): Dims {
  if (level === 1) {
    return rng.pick([
      { rows: 2, cols: 3 },
      { rows: 3, cols: 2 },
    ]);
  }
  if (level === 3) {
    const n = rng.int(2, 5);
    return rng.chance(1, 2) ? { rows: 1, cols: n } : { rows: n, cols: 1 };
  }
  const rows = rng.pick(SIZES);
  const cols = rng.pick(needsSwapToDiffer ? SIZES.filter((size) => size !== rows) : SIZES);
  return { rows, cols };
}

export const dim: SkillGenerator = {
  sample(rng, level, { target }) {
    return {
      form: 'dim',
      A: drawMatrix(rng, sampleDims(rng, level, target !== undefined), range(1, 9)),
    };
  },

  body(data) {
    if (data.form !== 'dim') throw wrongForm('dim', data.form);
    return {
      kind: 'dims',
      prompt: { key: 'dim_find' },
      data,
      correct: { kind: 'dims', ...shape(data.A) },
    };
  },
};
