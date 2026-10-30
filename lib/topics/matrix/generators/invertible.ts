import type { Rng } from '@/lib/core/prng';
import type { Matrix } from '@/lib/core/types';
import { det, matrix } from '../ops';
import type { Probe, SkillGenerator } from '../types';
import { drawMatrix, fromFlat, nonZero, range, wrongForm } from './sample';

/** Whether to draw a matrix with det = 0. A target forces the side it can show. */
function isSingular(rng: Rng, { target }: Probe): boolean {
  if (target === 'M18_INV_SINGULAR') return true;
  if (target === 'M19_INV_ZERO_ENTRY') return false;
  return rng.chance(1, 2);
}

/** L1: no zero entries. Singular matrices have one row an obvious multiple of the other. */
function levelOne(rng: Rng, singular: boolean): Matrix {
  if (!singular) return drawMatrix(rng, { rows: 2, cols: 2 }, range(1, 7));
  // Small enough that the multiple stays within 1–9.
  const [x, y] = [rng.int(1, 3), rng.int(1, 3)];
  const t = rng.pick([2, 3]);
  const rows = [
    [x, y],
    [t * x, t * y],
  ];
  return matrix(rng.chance(1, 2) ? rows : [rows[1], rows[0]]);
}

/** L2: always a zero entry. A 2×2 with a zero entry is singular only with a zero row or column. */
function levelTwo(rng: Rng, singular: boolean): Matrix {
  const pool = nonZero(7);
  const cells = [rng.pick(pool), rng.pick(pool), rng.pick(pool), rng.pick(pool)];
  if (singular) {
    const zeroLine = rng.pick([
      [0, 1],
      [2, 3],
      [0, 2],
      [1, 3],
    ]);
    for (const cell of zeroLine) cells[cell] = 0;
  } else {
    cells[rng.int(0, 3)] = 0;
  }
  return fromFlat(cells, { rows: 2, cols: 2 });
}

/** L3: 3×3. Singular matrices have a row that is a multiple of, or the sum of, the others. */
function levelThree(rng: Rng, singular: boolean, needsZero: boolean): Matrix {
  const pool = range(-2, 4);
  const row = () => [rng.pick(pool), rng.pick(pool), rng.pick(pool)];
  if (singular) {
    const [first, second] = [row(), row()];
    const third = rng.chance(1, 2)
      ? first.map((value, j) => value + second[j])
      : first.map((value) => value * 2);
    return matrix(rng.shuffle([first, second, third]));
  }
  const cells = [...row(), ...row(), ...row()];
  if (needsZero) cells[rng.int(0, 8)] = 0;
  return fromFlat(cells, { rows: 3, cols: 3 });
}

export const invertible: SkillGenerator = {
  sample(rng, level, probe) {
    const singular = isSingular(rng, probe);
    if (level === 1) return { form: 'invertible', A: levelOne(rng, singular) };
    if (level === 2) return { form: 'invertible', A: levelTwo(rng, singular) };
    const needsZero = probe.target === 'M19_INV_ZERO_ENTRY' || rng.chance(1, 2);
    return { form: 'invertible', A: levelThree(rng, singular, needsZero) };
  },

  body(data) {
    if (data.form !== 'invertible') throw wrongForm('invertible', data.form);
    return {
      kind: 'choice',
      prompt: { key: 'invertible_find' },
      data,
      options: [
        { id: 'has_inverse', labelKey: 'has_inverse' },
        { id: 'no_inverse', labelKey: 'no_inverse' },
      ],
      correct: { kind: 'choice', id: det(data.A).isZero() ? 'no_inverse' : 'has_inverse' },
    };
  },
};
