import { Rational } from './rational';

/** Largest radicand kept after simplifying. Trial division stays cheap well past this. */
export const SURD_MAX_RADICAND = 1_000_000;

/** n = k² · r with r squarefree. */
function splitSquares(n: number): { outside: number; inside: number } {
  if (!Number.isSafeInteger(n) || n < 1) {
    throw new RangeError(`Surd: radicand ${n} is not a positive integer`);
  }
  let outside = 1;
  let inside = n;
  for (let p = 2; p * p <= inside; p += 1) {
    while (inside % (p * p) === 0) {
      inside /= p * p;
      outside *= p;
    }
  }
  return { outside, inside };
}

function toRational(value: Rational | number): Rational {
  return typeof value === 'number' ? Rational.of(value) : value;
}

/**
 * Exact c·√r with c rational and r a squarefree positive integer (r = 1 for a rational).
 * There is one form per value, so two Surds are equal exactly when their parts are.
 * Every vector answer (lengths, unit vectors, cos θ, areas) fits this form (docs/VECTORS.md §3.1).
 */
export class Surd {
  static readonly ZERO = new Surd(Rational.ZERO, 1);
  static readonly ONE = new Surd(Rational.ONE, 1);

  readonly coeff: Rational;
  readonly radicand: number;

  private constructor(coeff: Rational, radicand: number) {
    this.coeff = coeff;
    this.radicand = radicand;
  }

  /** coeff · √radicand, simplified: of(1, 18) is 3√2. */
  static of(coeff: Rational | number, radicand = 1): Surd {
    const c = toRational(coeff);
    if (c.isZero()) return Surd.ZERO;
    const { outside, inside } = splitSquares(radicand);
    if (inside > SURD_MAX_RADICAND) {
      throw new RangeError(`Surd: radicand ${inside} exceeds ${SURD_MAX_RADICAND}`);
    }
    return new Surd(c.mul(Rational.of(outside)), inside);
  }

  static rational(value: Rational | number): Surd {
    return Surd.of(value, 1);
  }

  /** √q for q ≥ 0: √(p/d) = √(p·d) / d. */
  static sqrt(value: Rational | number): Surd {
    const q = toRational(value);
    if (q.sign() < 0) throw new RangeError(`Surd: square root of negative ${q.toString()}`);
    if (q.isZero()) return Surd.ZERO;
    return Surd.of(Rational.of(1, q.d), q.n * q.d);
  }

  /** Reads the form printed by toString, such as "-3/2√2". Student input goes through parse.ts. */
  static parse(text: string): Surd {
    const match = /^(-?)(\d+(?:\/\d+)?)?√(\d+)$/.exec(text);
    if (!match) return Surd.rational(Rational.parse(text));
    const [, sign, coeff, radicand] = match;
    const c = coeff === undefined ? Rational.ONE : Rational.parse(coeff);
    return Surd.of(sign === '-' ? c.neg() : c, Number(radicand));
  }

  mul(other: Surd | Rational | number): Surd {
    const o = other instanceof Surd ? other : Surd.rational(other);
    if (this.radicand === o.radicand) {
      return Surd.of(this.coeff.mul(o.coeff).mul(Rational.of(this.radicand)), 1);
    }
    return Surd.of(this.coeff.mul(o.coeff), this.radicand * o.radicand);
  }

  /** 1/(c√r) = √r / (c·r). */
  inv(): Surd {
    if (this.isZero()) throw new RangeError('Surd: division by zero');
    return Surd.of(this.coeff.mul(Rational.of(this.radicand)).inv(), this.radicand);
  }

  div(other: Surd | Rational | number): Surd {
    const o = other instanceof Surd ? other : Surd.rational(other);
    return this.mul(o.inv());
  }

  neg(): Surd {
    return this.isZero() ? this : new Surd(this.coeff.neg(), this.radicand);
  }

  abs(): Surd {
    return new Surd(this.coeff.abs(), this.radicand);
  }

  /** (c√r)² = c²·r. */
  square(): Rational {
    return this.coeff.mul(this.coeff).mul(Rational.of(this.radicand));
  }

  /** The sum when both share a radicand (or either is zero), otherwise null: √2 + √5 is not one Surd. */
  addSame(other: Surd): Surd | null {
    if (this.isZero()) return other;
    if (other.isZero()) return this;
    if (this.radicand !== other.radicand) return null;
    return Surd.of(this.coeff.add(other.coeff), this.radicand);
  }

  sign(): -1 | 0 | 1 {
    return this.coeff.sign();
  }

  isZero(): boolean {
    return this.coeff.isZero();
  }

  isRational(): boolean {
    return this.radicand === 1;
  }

  /** The value as a Rational, or throws when it is irrational. */
  toRational(): Rational {
    if (!this.isRational()) throw new RangeError(`Surd: ${this.toString()} is irrational`);
    return this.coeff;
  }

  equals(other: Surd): boolean {
    return this.radicand === other.radicand && this.coeff.equals(other.coeff);
  }

  /** Compares by sign, then by square, so no float is ever involved. */
  compare(other: Surd): -1 | 0 | 1 {
    const [a, b] = [this.sign(), other.sign()];
    if (a !== b) return a < b ? -1 : 1;
    if (a === 0) return 0;
    const bySquare = this.square().compare(other.square());
    return (a > 0 ? bySquare : -bySquare) as -1 | 0 | 1;
  }

  /** Canonical text: "3", "-3/2", "√2", "-√2", "3√2", "3/2√2". */
  toString(): string {
    if (this.isRational()) return this.coeff.toString();
    const c = this.coeff;
    if (c.equals(Rational.ONE)) return `√${this.radicand}`;
    if (c.equals(Rational.ONE.neg())) return `-√${this.radicand}`;
    return `${c.toString()}√${this.radicand}`;
  }

  toJSON(): string {
    return this.toString();
  }
}

/** For students, one line with a typographic minus: "3√2", "−√3/2", "3√2/2", "−3/2". */
export function surdText(value: Surd): string {
  const { n, d } = value.coeff;
  const top = value.isRational()
    ? String(n)
    : `${n === 1 ? '' : n === -1 ? '-' : String(n)}√${value.radicand}`;
  return (d === 1 ? top : `${top}/${d}`).replace('-', '−');
}

/** KaTeX source: 3\sqrt{2}, -\frac{\sqrt{3}}{2}. */
export function surdLatex(value: Surd): string {
  const { n, d } = value.coeff;
  const sign = n < 0 ? '-' : '';
  const size = Math.abs(n);
  const top = value.isRational()
    ? String(size)
    : `${size === 1 ? '' : String(size)}\\sqrt{${value.radicand}}`;
  return d === 1 ? `${sign}${top}` : `${sign}\\frac{${top}}{${d}}`;
}
