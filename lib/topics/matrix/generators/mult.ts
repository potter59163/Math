import type { Rng } from '@/lib/core/prng';
import type { Matrix } from '@/lib/core/types';
import { mul, shape } from '../ops';
import type { Probe, SkillGenerator } from '../types';
import { asymmetricSquare, drawMatrix, range, wrongForm } from './sample';

const L1_POOL = range(0, 5);
const L1_LURE_POOL = range(1, 5);
const L2_POOL = range(-5, 5);
const L3_POOL = range(-4, 6);

function squarePair(rng: Rng, pool: number[]): { A: Matrix; B: Matrix } {
  return { A: asymmetricSquare(rng, pool), B: asymmetricSquare(rng, pool) };
}

/** Which L3 shape: ROW_ROW only exists on 2×3·3×3 and COL_COL only on 3×3·3×1. */
function wideShape(rng: Rng, { targetVariant }: Probe): boolean {
  if (targetVariant === 'ROW_ROW') return true;
  if (targetVariant === 'COL_COL') return false;
  return rng.chance(1, 2);
}

export const mult: SkillGenerator = {
  sample(rng, level, probe) {
    if (level === 1) {
      // A probe for M09 avoids zeros, which would make cell-by-cell answers look wrong at a glance.
      const pool = probe.target === 'M09_MULT_ELEMENTWISE' ? L1_LURE_POOL : L1_POOL;
      return { form: 'mult', ...squarePair(rng, pool) };
    }
    if (level === 2) {
      if (probe.target !== undefined || rng.chance(1, 2)) {
        return { form: 'mult', ...squarePair(rng, L2_POOL) };
      }
      return {
        form: 'mult',
        A: drawMatrix(rng, { rows: 2, cols: 3 }, L2_POOL),
        B: drawMatrix(rng, { rows: 3, cols: 2 }, L2_POOL),
      };
    }
    return wideShape(rng, probe)
      ? {
          form: 'mult',
          A: drawMatrix(rng, { rows: 2, cols: 3 }, L3_POOL),
          B: drawMatrix(rng, { rows: 3, cols: 3 }, L3_POOL),
        }
      : {
          form: 'mult',
          A: drawMatrix(rng, { rows: 3, cols: 3 }, L3_POOL),
          B: drawMatrix(rng, { rows: 3, cols: 1 }, L3_POOL),
        };
  },

  body(data, level) {
    if (data.form !== 'mult') throw wrongForm('mult', data.form);
    const { A, B } = data;
    return {
      // L3 shapes differ, so the button tests whether the student trusts the dimension rule.
      kind: level === 3 ? 'matrix_or_undefined' : 'matrix',
      prompt: { key: 'mult_find' },
      data,
      grid: { rows: shape(A).rows, cols: shape(B).cols },
      correct: { kind: 'matrix', value: mul(A, B) },
    };
  },
};
