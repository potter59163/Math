import type { Rng } from '@/lib/core/prng';
import type { Dims } from '@/lib/core/types';
import { add, sameShape, shape, sub } from '../ops';
import type { MatrixData, Probe, SkillGenerator } from '../types';
import { drawMatrix, matrixWithNegatives, range, wrongForm } from './sample';

const SIGNED = range(-9, 9);

const dims = (rows: number, cols: number): Dims => ({ rows, cols });

const MISMATCHED: Record<2 | 3, [Dims, Dims][]> = {
  2: [
    [dims(2, 2), dims(2, 3)],
    [dims(2, 2), dims(3, 2)],
    [dims(2, 3), dims(3, 2)],
    [dims(2, 3), dims(2, 2)],
    [dims(3, 2), dims(2, 2)],
  ],
  3: [
    [dims(3, 3), dims(3, 2)],
    [dims(3, 3), dims(2, 3)],
    [dims(3, 2), dims(3, 3)],
    [dims(2, 3), dims(3, 3)],
  ],
};

function isMismatch(rng: Rng, { target }: Probe): boolean {
  if (target === 'M04_ADD_DIM_MISMATCH') return true;
  if (target === 'M05_SUB_REVERSED') return false;
  return rng.chance(1, 4);
}

function sampleMismatch(rng: Rng, level: 2 | 3): MatrixData {
  const [dimsA, dimsB] = rng.pick(MISMATCHED[level]);
  return {
    form: 'addsub',
    op: rng.pick(['add', 'sub'] as const),
    A: drawMatrix(rng, dimsA, SIGNED),
    B: drawMatrix(rng, dimsB, SIGNED),
  };
}

export const addsub: SkillGenerator = {
  sample(rng, level, probe) {
    if (level === 1) {
      const pool = range(0, 9);
      return {
        form: 'addsub',
        op: 'add',
        A: drawMatrix(rng, dims(2, 2), pool),
        B: drawMatrix(rng, dims(2, 2), pool),
      };
    }
    if (isMismatch(rng, probe)) return sampleMismatch(rng, level);
    if (level === 2) {
      const size = rng.chance(1, 4) ? dims(2, 3) : dims(2, 2);
      return {
        form: 'addsub',
        op: 'sub',
        A: drawMatrix(rng, size, SIGNED),
        // Two negatives make students subtract a negative, the step this level is for.
        B: matrixWithNegatives(rng, size, SIGNED, 2),
      };
    }
    return {
      form: 'addsub',
      op: probe.target === 'M05_SUB_REVERSED' ? 'sub' : rng.pick(['add', 'sub'] as const),
      A: drawMatrix(rng, dims(3, 3), SIGNED),
      B: drawMatrix(rng, dims(3, 3), SIGNED),
    };
  },

  body(data, level) {
    if (data.form !== 'addsub') throw wrongForm('addsub', data.form);
    const { op, A, B } = data;
    return {
      // From L2 on the "undefined" button is always there, so its presence gives nothing away.
      kind: level === 1 ? 'matrix' : 'matrix_or_undefined',
      prompt: { key: op === 'add' ? 'addsub_add' : 'addsub_sub' },
      data,
      grid: shape(A),
      correct: sameShape(A, B)
        ? { kind: 'matrix', value: op === 'add' ? add(A, B) : sub(A, B) }
        : { kind: 'undefined' },
    };
  },
};
