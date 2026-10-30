import type { Rational } from '@/lib/core/rational';
import type { Dims, Matrix } from '@/lib/core/types';

export function num(value: Rational): string {
  if (value.isInteger()) return String(value.n);
  const fraction = `\\frac{${Math.abs(value.n)}}{${value.d}}`;
  return value.sign() < 0 ? `-${fraction}` : fraction;
}

/** A factor inside a product: negatives get brackets, as on paper. */
export function factor(value: Rational): string {
  return value.sign() < 0 ? `(${num(value)})` : num(value);
}

export function mat(A: Matrix): string {
  const rows = A.map((row) => row.map(num).join(' & ')).join(' \\\\ ');
  return `\\begin{bmatrix} ${rows} \\end{bmatrix}`;
}

export function dims({ rows, cols }: Dims): string {
  return `${rows} \\times ${cols}`;
}

/** A sum of products, as in 2 \cdot 1 + 1 \cdot 2. */
export function dot(pairs: readonly (readonly Rational[])[]): string {
  return pairs.map((pair) => pair.map(factor).join(' \\cdot ')).join(' + ');
}
