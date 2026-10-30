import type { Dims, Level } from '@/lib/core/types';
import { subscript } from '../format';
import type { SkillGenerator } from '../types';
import { distinctMatrix, nonZero, range, wrongForm } from './sample';

// Named index_skill.ts because generators/index.ts is the module entry point.

const SHAPE: Record<Level, Dims> = {
  1: { rows: 3, cols: 3 },
  2: { rows: 3, cols: 4 },
  3: { rows: 4, cols: 3 },
};

const POOL: Record<Level, number[]> = {
  1: range(1, 9),
  2: range(1, 20),
  // 12 cells from 18 values always leaves at least 3 negatives.
  3: nonZero(9),
};

export const indexSkill: SkillGenerator = {
  sample(rng, level, { target }) {
    const dims = SHAPE[level];
    const A = distinctMatrix(rng, dims, POOL[level]);
    const cells: [number, number][] = [];
    for (let i = 1; i <= dims.rows; i += 1) {
      for (let j = 1; j <= dims.cols; j += 1) {
        // A probe needs aⱼᵢ to exist as well.
        const mirrored = j <= dims.rows && i <= dims.cols;
        if (i !== j && (mirrored || target === undefined)) cells.push([i, j]);
      }
    }
    const [i, j] = rng.pick(cells);
    return { form: 'index', A, i, j };
  },

  body(data) {
    if (data.form !== 'index') throw wrongForm('index', data.form);
    const { A, i, j } = data;
    return {
      kind: 'cell',
      prompt: { key: 'index_find', params: { sub: `${subscript(i)}${subscript(j)}` } },
      data,
      correct: { kind: 'scalar', value: A[i - 1][j - 1] },
    };
  },
};
