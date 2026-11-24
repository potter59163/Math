import { Rational } from '@/lib/core/rational';
import { Surd } from '@/lib/core/surd';
import { STANDARD_ANGLES, type Angle, type Vec } from './types';

export type { Vec } from './types';

type PartInput = number | string | Rational;

function toRational(part: PartInput): Rational {
  if (part instanceof Rational) return part;
  return typeof part === 'number' ? Rational.of(part) : Rational.parse(part);
}

/** A 2D or 3D vector from integers, canonical strings such as "-3/2", or Rationals. */
export function vec(...parts: PartInput[]): Vec {
  if (parts.length !== 2 && parts.length !== 3) {
    throw new Error(`vec: a vector has 2 or 3 components, not ${parts.length}`);
  }
  return parts.map(toRational);
}

function requireSameSize(u: Vec, v: Vec, op: string): void {
  if (u.length !== v.length) throw new Error(`${op}: vectors must be the same size`);
}

export function isZeroVec(v: Vec): boolean {
  return v.every((part) => part.isZero());
}

export function equals(u: Vec, v: Vec): boolean {
  return u.length === v.length && u.every((part, i) => part.equals(v[i]));
}

export function add(u: Vec, v: Vec): Vec {
  requireSameSize(u, v, 'add');
  return u.map((part, i) => part.add(v[i]));
}

export function sub(u: Vec, v: Vec): Vec {
  requireSameSize(u, v, 'sub');
  return u.map((part, i) => part.sub(v[i]));
}

export function scale(k: Rational, v: Vec): Vec {
  return v.map((part) => k.mul(part));
}

export function neg(v: Vec): Vec {
  return v.map((part) => part.neg());
}

/** k₁v₁ + k₂v₂ + …, as a student combines vectors. */
export function combine(terms: readonly { k: Rational; vec: Vec }[]): Vec {
  const [first, ...rest] = terms;
  return rest.reduce(
    (total, term) => add(total, scale(term.k, term.vec)),
    scale(first.k, first.vec),
  );
}

export function sum(values: readonly Rational[]): Rational {
  return values.reduce((total, value) => total.add(value), Rational.ZERO);
}

/** The products a·b of matching components, which the dot product adds up. */
export function dotTerms(u: Vec, v: Vec): Rational[] {
  requireSameSize(u, v, 'dot');
  return u.map((part, i) => part.mul(v[i]));
}

export function dot(u: Vec, v: Vec): Rational {
  return sum(dotTerms(u, v));
}

function require3d(v: Vec, op: string): void {
  if (v.length !== 3) throw new Error(`${op}: needs a 3D vector`);
}

/**
 * The two products behind each component of u × v, as (first, second) with component = first − second:
 * (a₂b₃ − a₃b₂, a₃b₁ − a₁b₃, a₁b₂ − a₂b₁).
 */
export function crossTerms(u: Vec, v: Vec): [Rational, Rational][] {
  require3d(u, 'cross');
  require3d(v, 'cross');
  const [a1, a2, a3] = u;
  const [b1, b2, b3] = v;
  return [
    [a2.mul(b3), a3.mul(b2)],
    [a3.mul(b1), a1.mul(b3)],
    [a1.mul(b2), a2.mul(b1)],
  ];
}

export function cross(u: Vec, v: Vec): Vec {
  return crossTerms(u, v).map(([first, second]) => first.sub(second));
}

/** u·(v × w), whose absolute value is the volume of the box on u, v, w. */
export function triple(u: Vec, v: Vec, w: Vec): Rational {
  return dot(u, cross(v, w));
}

/** The 2D determinant a₁b₂ − a₂b₁, which V14 computes in place of the dot product. */
export function det2(u: Vec, v: Vec): Rational {
  if (u.length !== 2 || v.length !== 2) throw new Error('det2: needs 2D vectors');
  return u[0].mul(v[1]).sub(u[1].mul(v[0]));
}

/** u ∥ v, including when either is zero. */
export function isParallel(u: Vec, v: Vec): boolean {
  requireSameSize(u, v, 'isParallel');
  return u.length === 2 ? det2(u, v).isZero() : isZeroVec(cross(u, v));
}

export function normSq(v: Vec): Rational {
  return dot(v, v);
}

export function norm(v: Vec): Surd {
  return Surd.sqrt(normSq(v));
}

export function toSurds(v: Vec): Surd[] {
  return v.map((part) => Surd.rational(part));
}

/** v / |v|: every component shares the radicand of |v|. */
export function unit(v: Vec): Surd[] {
  if (isZeroVec(v)) throw new Error('unit: the zero vector has no direction');
  const length = norm(v);
  return toSurds(v).map((part) => part.div(length));
}

/** u·v / (|u||v|), exactly. */
export function cosAngle(u: Vec, v: Vec): Surd {
  if (isZeroVec(u) || isZeroVec(v)) throw new Error('cosAngle: the zero vector has no angle');
  return Surd.rational(dot(u, v)).div(norm(u).mul(norm(v)));
}

const HALF = Rational.of(1, 2);

/** cos θ of a standard angle, exactly. */
export function cosOf(theta: Angle): Surd {
  switch (theta) {
    case 0:
      return Surd.ONE;
    case 30:
      return Surd.of(HALF, 3);
    case 45:
      return Surd.of(HALF, 2);
    case 60:
      return Surd.rational(HALF);
    case 90:
      return Surd.ZERO;
    case 120:
      return Surd.rational(HALF.neg());
    case 135:
      return Surd.of(HALF.neg(), 2);
    case 150:
      return Surd.of(HALF.neg(), 3);
    case 180:
      return Surd.ONE.neg();
  }
}

/** sin θ = cos(90° − θ), which for θ in 0°..180° is never negative. */
export function sinOf(theta: Angle): Surd {
  const reflected = Math.abs(90 - theta) as Angle;
  return cosOf(reflected);
}

/** The standard angle with this cosine, or null. Compares exact Surds, never an arccos. */
export function angleOfCos(cos: Surd): Angle | null {
  return STANDARD_ANGLES.find((theta) => cosOf(theta).equals(cos)) ?? null;
}

export function angleOf(u: Vec, v: Vec): Angle | null {
  return angleOfCos(cosAngle(u, v));
}

export function isStandardAngle(value: number): value is Angle {
  return (STANDARD_ANGLES as readonly number[]).includes(value);
}
