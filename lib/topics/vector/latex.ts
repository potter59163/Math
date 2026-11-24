import { Rational } from '@/lib/core/rational';
import { Surd, surdLatex } from '@/lib/core/surd';
import type { Slot, Term } from './types';

export function num(value: Rational): string {
  if (value.isInteger()) return String(value.n);
  const fraction = `\\frac{${Math.abs(value.n)}}{${value.d}}`;
  return value.sign() < 0 ? `-${fraction}` : fraction;
}

/** A factor inside a product: negatives get brackets, as on paper. */
export function factor(value: Rational): string {
  return value.sign() < 0 ? `(${num(value)})` : num(value);
}

export function surd(value: Surd): string {
  return surdLatex(value);
}

export function surdFactor(value: Surd): string {
  return value.sign() < 0 ? `(${surd(value)})` : surd(value);
}

function slot(part: Slot): string {
  return typeof part === 'string' ? part : num(part);
}

/** (a, b, c), as the textbook writes vectors and points. */
export function tuple(parts: readonly Slot[]): string {
  return `\\left(${parts.map(slot).join(', ')}\\right)`;
}

export function surdTuple(parts: readonly Surd[]): string {
  return `\\left(${parts.map(surd).join(', ')}\\right)`;
}

export function arrow(from: string, to: string): string {
  return `\\overrightarrow{${from}${to}}`;
}

function size(value: Rational): string {
  return value.equals(Rational.ONE) ? '' : num(value);
}

export function term({ k, from, to }: Term): string {
  const body = `${size(k.abs())}${arrow(from, to)}`;
  return k.sign() < 0 ? `-${body}` : body;
}

/** AB + ½BC − AD with arrows. */
export function figureExpr(terms: readonly Term[]): string {
  return terms
    .map((t, index) => {
      if (index === 0) return term(t);
      const body = term({ ...t, k: t.k.abs() });
      return `${t.k.sign() < 0 ? '-' : '+'} ${body}`;
    })
    .join(' ');
}

/** A sum of products, as in 3 \cdot 4 + (-2) \cdot 5. */
export function products(pairs: readonly (readonly [Rational, Rational])[]): string {
  return pairs.map(([a, b]) => `${factor(a)} \\cdot ${factor(b)}`).join(' + ');
}

/** a² + b² + c² with the numbers put in: 1^2 + (-4)^2 + 1^2. */
export function squares(parts: readonly Rational[]): string {
  return parts.map((part) => `${factor(part)}^2`).join(' + ');
}

export function degrees(theta: number): string {
  return `${theta}^\\circ`;
}
