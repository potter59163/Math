import { Rational } from '@/lib/core/rational';
import type { Dims, Matrix } from '@/lib/core/types';

type CellInput = number | string | Rational;

function toRational(cell: CellInput): Rational {
  if (cell instanceof Rational) return cell;
  return typeof cell === 'number' ? Rational.of(cell) : Rational.parse(cell);
}

/** Builds a Matrix from rows of integers, canonical strings such as "-3/2", or Rationals. */
export function matrix(rows: readonly (readonly CellInput[])[]): Matrix {
  const cols = rows[0]?.length ?? 0;
  if (cols === 0 || rows.some((row) => row.length !== cols)) {
    throw new Error('matrix: rows must be non-empty and the same length');
  }
  return rows.map((row) => row.map(toRational));
}

export function shape(A: Matrix): Dims {
  return { rows: A.length, cols: A[0].length };
}

export function sameDims(a: Dims, b: Dims): boolean {
  return a.rows === b.rows && a.cols === b.cols;
}

export function sameShape(A: Matrix, B: Matrix): boolean {
  return sameDims(shape(A), shape(B));
}

export function isSquare(A: Matrix): boolean {
  return A.length === A[0].length;
}

function requireSameShape(A: Matrix, B: Matrix, op: string): void {
  if (!sameShape(A, B)) throw new Error(`${op}: matrices must have the same shape`);
}

function requireSize(A: Matrix, n: number, op: string): void {
  if (A.length !== n || A[0].length !== n) throw new Error(`${op}: needs a ${n}×${n} matrix`);
}

export function identity(n: number): Matrix {
  return Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i === j ? Rational.ONE : Rational.ZERO)),
  );
}

export function equals(A: Matrix, B: Matrix): boolean {
  return sameShape(A, B) && A.every((row, i) => row.every((cell, j) => cell.equals(B[i][j])));
}

export function add(A: Matrix, B: Matrix): Matrix {
  requireSameShape(A, B, 'add');
  return A.map((row, i) => row.map((cell, j) => cell.add(B[i][j])));
}

export function sub(A: Matrix, B: Matrix): Matrix {
  requireSameShape(A, B, 'sub');
  return A.map((row, i) => row.map((cell, j) => cell.sub(B[i][j])));
}

export function scalar(k: Rational, A: Matrix): Matrix {
  return A.map((row) => row.map((cell) => k.mul(cell)));
}

/** Cell-by-cell product. Not matrix multiplication; it is what M09 computes. */
export function hadamard(A: Matrix, B: Matrix): Matrix {
  requireSameShape(A, B, 'hadamard');
  return A.map((row, i) => row.map((cell, j) => cell.mul(B[i][j])));
}

export function mul(A: Matrix, B: Matrix): Matrix {
  if (A[0].length !== B.length) throw new Error('mul: cols(A) must equal rows(B)');
  return A.map((row) =>
    B[0].map((_, j) => row.reduce((sum, cell, k) => sum.add(cell.mul(B[k][j])), Rational.ZERO)),
  );
}

export function transpose(A: Matrix): Matrix {
  return A[0].map((_, j) => A.map((row) => row[j]));
}

export function det2(A: Matrix): Rational {
  requireSize(A, 2, 'det2');
  return A[0][0].mul(A[1][1]).sub(A[0][1].mul(A[1][0]));
}

/** The six products of Sarrus' rule: down = aei, bfg, cdh and up = ceg, afh, bdi. */
export function sarrusLines(A: Matrix): { down: Rational[]; up: Rational[] } {
  requireSize(A, 3, 'sarrusLines');
  const [[a, b, c], [d, e, f], [g, h, i]] = A;
  return {
    down: [a.mul(e).mul(i), b.mul(f).mul(g), c.mul(d).mul(h)],
    up: [c.mul(e).mul(g), a.mul(f).mul(h), b.mul(d).mul(i)],
  };
}

export function sum(values: readonly Rational[]): Rational {
  return values.reduce((total, value) => total.add(value), Rational.ZERO);
}

export function det3(A: Matrix): Rational {
  const { down, up } = sarrusLines(A);
  return sum(down).sub(sum(up));
}

export function det(A: Matrix): Rational {
  return A.length === 2 ? det2(A) : det3(A);
}

/** Determinant of a 3×3 matrix with row i and column j (1-based) removed. */
export function minor(A: Matrix, i: number, j: number): Rational {
  requireSize(A, 3, 'minor');
  const rest = A.filter((_, r) => r !== i - 1).map((row) => row.filter((_, c) => c !== j - 1));
  return det2(rest);
}

/** [[d, −b], [−c, a]]: the matrix inv2 divides by det. */
export function adjugate2(A: Matrix): Matrix {
  requireSize(A, 2, 'adjugate2');
  const [[a, b], [c, d]] = A;
  return [
    [d, b.neg()],
    [c.neg(), a],
  ];
}

export function inv2(A: Matrix): Matrix {
  const det = det2(A);
  if (det.isZero()) throw new Error('inv2: matrix is singular');
  return scalar(det.inv(), adjugate2(A));
}
