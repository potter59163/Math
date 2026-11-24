import type { VectorChoiceKey } from '@/lib/content/th.vector';
import { Rational } from '@/lib/core/rational';
import { Surd } from '@/lib/core/surd';
import { figureKey } from './format';
import {
  add,
  combine,
  cosAngle,
  cosOf,
  cross,
  dot,
  equals,
  norm,
  angleOf,
  scale,
  sub,
  toSurds,
  triple,
  unit,
} from './ops';
import type {
  DataOf,
  Figure,
  LinearTerm,
  PointLabel,
  Quantity,
  Slot,
  Term,
  Unknown,
  Vec,
  VectorAnswer,
  VectorData,
} from './types';

// The answer key of every item form, computed from the data alone. Generators and the catalog both
// use it, so a diagnostic is always compared with the same correct answer the item carries.

export const QUANTITY_KIND: Record<Quantity, 'vector' | 'scalar'> = {
  velocity: 'vector',
  speed: 'scalar',
  displacement: 'vector',
  distance: 'scalar',
  weight: 'vector',
  mass: 'scalar',
  force: 'vector',
  acceleration: 'vector',
  momentum: 'vector',
  temperature: 'scalar',
  time: 'scalar',
  volume: 'scalar',
  energy: 'scalar',
  area: 'scalar',
};

/** The scalar each vector quantity is mixed up with, and back (V01). */
export const QUANTITY_PARTNER: Partial<Record<Quantity, Quantity>> = {
  velocity: 'speed',
  speed: 'velocity',
  displacement: 'distance',
  distance: 'displacement',
  weight: 'mass',
  mass: 'weight',
};

export function quantityKey(quantity: Quantity): VectorChoiceKey {
  return `q_${quantity}`;
}

/** The options of the asked kind. A valid item has exactly one. */
export function quantityMatches({ ask, options }: DataOf<'quantity_kind'>): Quantity[] {
  return options.filter((quantity) => QUANTITY_KIND[quantity] === ask);
}

export function pointAt(figure: Figure, label: PointLabel): Vec {
  const found = figure.points.find((p) => p.label === label);
  if (!found) throw new Error(`pointAt: the figure has no point ${label}`);
  return found.at.map((part) => Rational.of(part));
}

export function termValue(figure: Figure, { k, from, to }: Term): Vec {
  return scale(k, sub(pointAt(figure, to), pointAt(figure, from)));
}

export function exprValue(figure: Figure, terms: readonly Term[]): Vec {
  return terms.map((t) => termValue(figure, t)).reduce((total, value) => add(total, value));
}

/** The option whose vector is `value`, if any. */
export function optionWithValue(
  figure: Figure,
  options: readonly Term[],
  value: Vec,
): Term | undefined {
  return options.find((option) => equals(termValue(figure, option), value));
}

/** What a figure_equal item asks for: `of`, or its negative. */
export function askedValue({ figure, of, negative }: DataOf<'figure_equal'>): Vec {
  const value = termValue(figure, of);
  return negative ? value.map((part) => part.neg()) : value;
}

function figureChoice(figure: Figure, options: readonly Term[], value: Vec): VectorAnswer {
  const option = optionWithValue(figure, options, value);
  if (!option) throw new Error('solve: no option has the asked vector');
  return { kind: 'choice', id: figureKey(option) };
}

export const isUnknown = (part: Slot): part is Unknown => typeof part === 'string';

export function known(parts: readonly Slot[]): Rational[] | null {
  return parts.every((part) => !isUnknown(part)) ? (parts as Rational[]) : null;
}

export interface UnknownAt {
  vector: 'u' | 'v';
  index: number;
}

export function unknownAt(u: readonly Slot[], v: readonly Slot[], name: Unknown): UnknownAt | null {
  const inU = u.indexOf(name);
  if (inU >= 0) return { vector: 'u', index: inU };
  const inV = v.indexOf(name);
  return inV >= 0 ? { vector: 'v', index: inV } : null;
}

/** The first component where both vectors are given and v's is not zero, which fixes k in u = kv. */
export function parallelPair(u: readonly Slot[], v: readonly Slot[]): number | null {
  const index = u.findIndex((part, i) => {
    const other = v[i];
    return !isUnknown(part) && !isUnknown(other) && !other.isZero() && !part.isZero();
  });
  return index >= 0 ? index : null;
}

/** k in u = kv, from the first fully given pair. */
export function parallelK({ u, v }: Pick<DataOf<'parallel'>, 'u' | 'v'>): Rational {
  const i = parallelPair(u, v);
  if (i === null) throw new Error('parallelK: no given pair fixes k');
  return (u[i] as Rational).div(v[i] as Rational);
}

/** The partner of the unknown, from the other vector. */
export function partnerOf(data: DataOf<'parallel'>): { at: UnknownAt; partner: Rational } {
  const at = unknownAt(data.u, data.v, data.ask);
  if (!at) throw new Error(`parallel: no unknown ${data.ask}`);
  const other = (at.vector === 'u' ? data.v : data.u)[at.index];
  if (isUnknown(other)) throw new Error('parallel: the partner of the unknown is unknown');
  return { at, partner: other };
}

export function parallelAnswer(data: DataOf<'parallel'>): Rational {
  const k = parallelK(data);
  const { at, partner } = partnerOf(data);
  return at.vector === 'u' ? k.mul(partner) : partner.div(k);
}

/** u·v = 0 solved for k, where k sits in u or v with a given partner. */
export function perpAnswer({ u, v }: DataOf<'perp'>): Rational {
  const at = unknownAt(u, v, 'k');
  if (!at) throw new Error('perp: no unknown k');
  const [own, other] = at.vector === 'u' ? [u, v] : [v, u];
  const coefficient = other[at.index];
  if (isUnknown(coefficient) || coefficient.isZero()) throw new Error('perp: k has no coefficient');
  let rest = Rational.ZERO;
  own.forEach((part, i) => {
    if (i === at.index) return;
    if (isUnknown(part) || isUnknown(other[i])) throw new Error('perp: a second unknown');
    rest = rest.add(part.mul(other[i] as Rational));
  });
  return rest.neg().div(coefficient);
}

/** k² = |u|² − (the other squares of v), from |u| = |v|. */
export function perpPropertySquare({ u, v }: DataOf<'perp_property'>): Rational {
  const others = v.filter((part): part is Rational => !isUnknown(part));
  return dot(u, u).sub(dot(others, others));
}

export function perpPropertyAnswer(data: DataOf<'perp_property'>): Rational {
  const root = Surd.sqrt(perpPropertySquare(data));
  if (!root.isRational() || root.isZero()) throw new Error('perp_property: k is not rational');
  return root.toRational();
}

export function linearVec(terms: readonly LinearTerm[]): Vec {
  return combine(terms.map(({ k, vec }) => ({ k: Rational.of(k), vec })));
}

/** The two vectors in the order the item multiplies them. */
export function crossFactors({ u, v, order }: DataOf<'cross'>): [Vec, Vec] {
  return order === 'uv' ? [u, v] : [v, u];
}

export const triangleSides = ({ A, B, C }: DataOf<'area_triangle'>): [Vec, Vec] => [
  sub(B, A),
  sub(C, A),
];

const asSurd = (value: Surd): VectorAnswer => ({ kind: 'surd', value });
const asVector = (value: Surd[]): VectorAnswer => ({ kind: 'vector', value });
const asScalar = (value: Rational): VectorAnswer => ({ kind: 'scalar', value });

export function solve(data: VectorData): VectorAnswer {
  switch (data.form) {
    case 'quantity_kind': {
      const [match] = quantityMatches(data);
      if (match === undefined) throw new Error('solve: no option of the asked kind');
      return { kind: 'choice', id: quantityKey(match) };
    }
    case 'figure_equal':
      return figureChoice(data.figure, data.options, askedValue(data));
    case 'figure_expr':
      return figureChoice(data.figure, data.options, exprValue(data.figure, data.expr));
    case 'points':
      return asVector(toSurds(sub(data.B, data.A)));
    case 'fourth_vertex':
      return asVector(toSurds(sub(add(data.A, data.C), data.B)));
    case 'linear':
      return asVector(toSurds(linearVec(data.terms)));
    case 'parallel':
      return asScalar(parallelAnswer(data));
    case 'magnitude':
      return asSurd(norm(data.v));
    case 'magnitude_combo':
      return asSurd(norm(linearVec(data.terms)));
    case 'distance':
      return asSurd(norm(sub(data.B, data.A)));
    case 'unit':
    case 'direction_cosines':
      return asVector(unit(data.v));
    case 'scaled_unit':
      return asVector(unit(data.v).map((part) => part.mul(data.length)));
    case 'dot':
      return asSurd(Surd.rational(dot(data.u, data.v)));
    case 'dot_polar':
      return asSurd(data.normU.mul(data.normV).mul(cosOf(data.theta)));
    case 'cos_angle':
      return asSurd(cosAngle(data.u, data.v));
    case 'angle': {
      const theta = angleOf(data.u, data.v);
      if (theta === null) throw new Error('solve: the angle is not standard');
      return asScalar(Rational.of(theta));
    }
    case 'perp':
      return asScalar(perpAnswer(data));
    case 'perp_property':
      return asScalar(perpPropertyAnswer(data));
    case 'cross':
      return asVector(toSurds(cross(...crossFactors(data))));
    case 'area_parallelogram':
      return asSurd(norm(cross(data.u, data.v)));
    case 'area_triangle':
      return asSurd(norm(cross(...triangleSides(data))).div(2));
    case 'volume':
      return asSurd(Surd.rational(triple(data.u, data.v, data.w).abs()));
  }
}
