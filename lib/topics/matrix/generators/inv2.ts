import type { Rng } from '@/lib/core/prng';
import type { Level } from '@/lib/core/types';
import { inv2 as inverseOf, matrix } from '../ops';
import type { Probe, SkillGenerator } from '../types';
import { range, wrongForm } from './sample';

type Cells = [a: number, b: number, c: number, d: number];

const determinant = ([a, b, c, d]: Cells): number => a * d - b * c;

/** True when A⁻¹ has a non-integer cell. */
const hasFraction = (cells: Cells): boolean => {
  const det = determinant(cells);
  return cells.some((cell) => cell % det !== 0);
};

const MAX_PRODUCT = 60;

/**
 * All-positive matrices whose |a| ≠ |d| and |b| ≠ |c|. With no zero entry those two conditions make
 * every M20 and M21 candidate apply and keep them apart, so any matrix in a pool is a valid item
 * and generation needs no rejection at all.
 */
function buildPool(keep: (cells: Cells) => boolean): Cells[] {
  const digits = range(1, 9);
  const pool: Cells[] = [];
  for (const a of digits) {
    for (const d of digits) {
      if (a === d || a * d > MAX_PRODUCT) continue;
      for (const b of digits) {
        for (const c of digits) {
          if (b === c || b * c > MAX_PRODUCT) continue;
          const cells: Cells = [a, b, c, d];
          if (keep(cells)) pool.push(cells);
        }
      }
    }
  }
  return pool;
}

const POOLS: Record<Level, Cells[]> = {
  1: buildPool((cells) => Math.abs(determinant(cells)) === 1),
  2: buildPool((cells) => Math.abs(determinant(cells)) >= 2 && Math.abs(determinant(cells)) <= 5),
  3: buildPool(
    (cells) =>
      Math.abs(determinant(cells)) >= 2 && Math.abs(determinant(cells)) <= 12 && hasFraction(cells),
  ),
};

/** Same matrix with a row or a column negated, which keeps |det| and every condition above. */
function negateLine([a, b, c, d]: Cells, line: number): Cells {
  switch (line) {
    case 0:
      return [-a, -b, c, d];
    case 1:
      return [a, b, -c, -d];
    case 2:
      return [-a, b, -c, d];
    default:
      return [a, -b, c, -d];
  }
}

function drawCells(rng: Rng, level: Level, { targetVariant }: Probe): Cells {
  const pool =
    targetVariant === 'NO_SWAP'
      ? // MISCONCEPTIONS §4: a and d far apart make a forgotten swap easy to see.
        POOLS[level].filter(([a, , , d]) => Math.abs(a - d) >= 3)
      : POOLS[level];
  const cells = rng.pick(pool);
  if (level === 1) return cells;
  if (level === 2) return rng.chance(1, 2) ? cells : negateLine(cells, rng.int(0, 3));
  // L3 needs det < 0, and negating one line flips the sign of det.
  return determinant(cells) < 0 ? cells : negateLine(cells, rng.int(0, 3));
}

export const inv2: SkillGenerator = {
  sample(rng, level, probe) {
    const [a, b, c, d] = drawCells(rng, level, probe);
    return {
      form: 'inv2',
      A: matrix([
        [a, b],
        [c, d],
      ]),
    };
  },

  body(data) {
    if (data.form !== 'inv2') throw wrongForm('inv2', data.form);
    return {
      kind: 'matrix',
      prompt: { key: 'inv2_find' },
      data,
      grid: { rows: 2, cols: 2 },
      correct: { kind: 'matrix', value: inverseOf(data.A) },
    };
  },
};
