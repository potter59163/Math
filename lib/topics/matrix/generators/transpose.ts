import type { Rng } from '@/lib/core/prng';
import type { Level, Matrix } from '@/lib/core/types';
import { shape, transpose as transposeOf } from '../ops';
import type { SkillGenerator } from '../types';
import { distinctMatrix, fromFlat, range, wrongForm } from './sample';

function sampleMatrix(rng: Rng, level: Level): Matrix {
  if (level === 1) return distinctMatrix(rng, { rows: 2, cols: 2 }, range(1, 9));
  if (level === 2) {
    const dims = rng.pick([
      { rows: 2, cols: 3 },
      { rows: 3, cols: 2 },
    ]);
    return distinctMatrix(rng, dims, range(1, 9));
  }
  const negatives = rng.int(2, 5);
  const values = [
    ...rng.sample(range(-9, -1), negatives),
    ...rng.sample(range(1, 9), 9 - negatives),
  ];
  return fromFlat(rng.shuffle(values), { rows: 3, cols: 3 });
}

export const transpose: SkillGenerator = {
  sample(rng, level) {
    return { form: 'transpose', A: sampleMatrix(rng, level) };
  },

  body(data) {
    if (data.form !== 'transpose') throw wrongForm('transpose', data.form);
    const { rows, cols } = shape(data.A);
    return {
      kind: 'matrix',
      prompt: { key: 'transpose_find' },
      data,
      grid: { rows: cols, cols: rows },
      correct: { kind: 'matrix', value: transposeOf(data.A) },
    };
  },
};
