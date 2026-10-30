import type { Rng } from '@/lib/core/prng';
import type { Dims, Matrix } from '@/lib/core/types';
import { matrix } from '../ops';

export function range(min: number, max: number): number[] {
  return Array.from({ length: max - min + 1 }, (_, i) => min + i);
}

/** −n..−1 and 1..n: every magnitude up to n, with no zero. */
export function nonZero(n: number): number[] {
  return [...range(-n, -1), ...range(1, n)];
}

/** Lays out `values` row by row. */
export function fromFlat(values: readonly number[], { rows, cols }: Dims): Matrix {
  return matrix(Array.from({ length: rows }, (_, i) => values.slice(i * cols, (i + 1) * cols)));
}

/** A matrix whose cells are drawn independently from `pool`. */
export function drawMatrix(rng: Rng, dims: Dims, pool: readonly number[]): Matrix {
  const values = Array.from({ length: dims.rows * dims.cols }, () => rng.pick(pool));
  return fromFlat(values, dims);
}

/** A matrix with no repeated values, so every transposed or rotated copy is told apart. */
export function distinctMatrix(rng: Rng, dims: Dims, pool: readonly number[]): Matrix {
  return fromFlat(rng.sample(pool, dims.rows * dims.cols), dims);
}

/** Draws from `pool`, with at least `minNegatives` cells drawn from −1..−9 instead. */
export function matrixWithNegatives(
  rng: Rng,
  dims: Dims,
  pool: readonly number[],
  minNegatives: number,
): Matrix {
  const cells = range(0, dims.rows * dims.cols - 1);
  const negative = new Set(rng.sample(cells, minNegatives));
  const values = cells.map((cell) =>
    negative.has(cell) ? rng.pick(pool.filter((value) => value < 0)) : rng.pick(pool),
  );
  return fromFlat(values, dims);
}

/** 2×2 with a₁₂ ≠ a₂₁, so that transposing it always changes it. */
export function asymmetricSquare(rng: Rng, pool: readonly number[]): Matrix {
  const [upper, lower] = rng.sample(pool, 2);
  return matrix([
    [rng.pick(pool), upper],
    [lower, rng.pick(pool)],
  ]);
}

export function wrongForm(skill: string, form: string): Error {
  return new Error(`${skill}: unexpected item form ${form}`);
}
