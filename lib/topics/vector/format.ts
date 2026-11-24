import { Rational } from '@/lib/core/rational';
import type { Surd } from '@/lib/core/surd';
import { surdText } from '@/lib/core/surd';
import type { DataOf, FigureKey, LinearTerm, ScaleKey, Slot, Term, Vec, VectorData } from './types';

/** Number for Thai copy, with a typographic minus. */
export function signed(value: number): string {
  return String(value).replace('-', '−');
}

/** An exact number on one line, with a typographic minus: −3/2. */
export function rationalText(value: Rational): string {
  return value.toString().replace('-', '−');
}

export { surdText };

function slotText(slot: Slot): string {
  return typeof slot === 'string' ? slot : rationalText(slot);
}

/** (3, 4, −4), the way the textbook writes a vector or a point. */
export function vecText(parts: readonly Slot[]): string {
  return `(${parts.map(slotText).join(', ')})`;
}

export function surdVecText(parts: readonly Surd[]): string {
  return `(${parts.map(surdText).join(', ')})`;
}

const AXES = ['i', 'j', 'k'];

/** 2i − j + 3k, leaving out zero components and writing ±1 as a bare sign. */
export function ijkText(v: Vec): string {
  const pieces = v.flatMap((part, index) => {
    if (part.isZero()) return [];
    const size = part.abs();
    const coeff = size.equals(Rational.ONE) ? '' : rationalText(size);
    return [{ negative: part.sign() < 0, text: `${coeff}${AXES[index]}` }];
  });
  if (pieces.length === 0) return '0';
  return pieces
    .map(({ negative, text }, index) => {
      if (index === 0) return negative ? `−${text}` : text;
      return `${negative ? '−' : '+'} ${text}`;
    })
    .join(' ');
}

const SCALE_KEYS: [Rational, ScaleKey][] = [
  [Rational.ONE, ''],
  [Rational.of(2), '2'],
  [Rational.of(1, 2), '1/2'],
];

/** The choice key of a figure option. Options only use the scales 1, 2 and ½. */
export function figureKey({ k, from, to }: Term): FigureKey {
  const found = SCALE_KEYS.find(([scale]) => scale.equals(k));
  if (!found) throw new Error(`figureKey: no option scale ${k.toString()}`);
  return `${found[1]}${from}${to}`;
}

function sizeText(size: Rational): string {
  if (size.equals(Rational.ONE)) return '';
  if (size.equals(Rational.of(1, 2))) return '½';
  return rationalText(size);
}

/** AB + ½BC − AD, as the prompt prints an expression of named vectors. */
export function figureExprText(terms: readonly Term[]): string {
  return terms
    .map(({ k, from, to }, index) => {
      const body = `${sizeText(k.abs())}${from}${to}`;
      if (index === 0) return k.sign() < 0 ? `−${body}` : body;
      return `${k.sign() < 0 ? '−' : '+'} ${body}`;
    })
    .join(' ');
}

/** 3u − 2v + w. */
export function linearExprText(terms: readonly Pick<LinearTerm, 'k' | 'name'>[]): string {
  return terms
    .map(({ k, name }, index) => {
      const size = Math.abs(k);
      const body = `${size === 1 ? '' : String(size)}${name}`;
      if (index === 0) return k < 0 ? `−${body}` : body;
      return `${k < 0 ? '−' : '+'} ${body}`;
    })
    .join(' ');
}

export interface Given {
  label: string;
  kind: 'vector' | 'point';
  value: Slot[];
  /** How the textbook writes it on this item. */
  notation: 'tuple' | 'ijk';
}

const vector = (label: string, value: Slot[], notation: Given['notation'] = 'tuple'): Given => ({
  label,
  kind: 'vector',
  value,
  notation,
});
const point = (label: string, value: Vec): Given => ({
  label,
  kind: 'point',
  value,
  notation: 'tuple',
});

function linearGivens({ terms, notation }: DataOf<'linear'>): Given[] {
  return terms.map(({ name, vec: value }) => vector(name, value, notation));
}

/** The vectors and points an item shows the student, in reading order. Others state theirs in words. */
export function givenVectors(data: VectorData): Given[] {
  switch (data.form) {
    case 'points':
    case 'distance':
      return [point('A', data.A), point('B', data.B)];
    case 'fourth_vertex':
    case 'area_triangle':
      return [point('A', data.A), point('B', data.B), point('C', data.C)];
    case 'linear':
      return linearGivens(data);
    case 'magnitude_combo':
      return data.terms.map(({ name, vec: value }) => vector(name, value));
    case 'parallel':
    case 'perp':
      return [vector('u', data.u), vector('v', data.v)];
    case 'perp_property':
      return [vector('u', data.u), vector('v', data.v)];
    case 'magnitude':
    case 'unit':
    case 'scaled_unit':
    case 'direction_cosines':
      return [vector('v', data.v)];
    case 'dot':
    case 'cos_angle':
    case 'angle':
    case 'cross':
    case 'area_parallelogram':
      return [vector('u', data.u), vector('v', data.v)];
    case 'volume':
      return [vector('u', data.u), vector('v', data.v), vector('w', data.w)];
    case 'quantity_kind':
    case 'figure_equal':
    case 'figure_expr':
    case 'dot_polar':
      return [];
  }
}
