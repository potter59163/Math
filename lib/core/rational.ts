const MAX_PART = 1e9;

function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0) {
    [x, y] = [y, x % y];
  }
  return x;
}

// Products of two parts can pass 2^53, where doubles silently round. Fail instead of being wrong.
function safe(value: number): number {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`Rational: ${value} is not a safe integer`);
  }
  return value;
}

/** Exact fraction: integer parts, denominator > 0, always in lowest terms, parts within 1e9. */
export class Rational {
  static readonly ZERO = new Rational(0, 1);
  static readonly ONE = new Rational(1, 1);

  readonly n: number;
  readonly d: number;

  private constructor(n: number, d: number) {
    this.n = n;
    this.d = d;
  }

  static of(n: number, d = 1): Rational {
    safe(n);
    safe(d);
    if (d === 0) throw new RangeError('Rational: denominator is zero');
    const divisor = gcd(n, d) * Math.sign(d);
    const numerator = n / divisor;
    const denominator = d / divisor;
    if (Math.abs(numerator) > MAX_PART || denominator > MAX_PART) {
      throw new RangeError(`Rational: ${numerator}/${denominator} exceeds ${MAX_PART}`);
    }
    // `+ 0` turns -0 into 0, which keeps deep equality and JSON honest.
    return new Rational(numerator + 0, denominator);
  }

  /** Reads the canonical form printed by toString, such as "-3/2". */
  static parse(text: string): Rational {
    const match = /^(-?\d+)(?:\/(\d+))?$/.exec(text);
    if (!match) throw new RangeError(`Rational: cannot parse ${JSON.stringify(text)}`);
    return Rational.of(Number(match[1]), match[2] === undefined ? 1 : Number(match[2]));
  }

  add(other: Rational): Rational {
    const g = gcd(this.d, other.d);
    const thisScale = other.d / g;
    const otherScale = this.d / g;
    return Rational.of(
      safe(safe(this.n * thisScale) + safe(other.n * otherScale)),
      safe(this.d * thisScale),
    );
  }

  sub(other: Rational): Rational {
    return this.add(other.neg());
  }

  mul(other: Rational): Rational {
    // Cross-reduce first so products stay small.
    const g1 = gcd(this.n, other.d);
    const g2 = gcd(other.n, this.d);
    return Rational.of(safe((this.n / g1) * (other.n / g2)), safe((this.d / g2) * (other.d / g1)));
  }

  div(other: Rational): Rational {
    return this.mul(other.inv());
  }

  neg(): Rational {
    return new Rational(-this.n + 0, this.d);
  }

  abs(): Rational {
    return new Rational(Math.abs(this.n), this.d);
  }

  inv(): Rational {
    return Rational.of(this.d, this.n);
  }

  pow(exponent: number): Rational {
    if (!Number.isInteger(exponent) || exponent < 0) {
      throw new RangeError(`Rational: exponent ${exponent} is not a non-negative integer`);
    }
    let result = Rational.ONE;
    for (let i = 0; i < exponent; i += 1) result = result.mul(this);
    return result;
  }

  equals(other: Rational): boolean {
    return this.n === other.n && this.d === other.d;
  }

  /** Returns -1, 0 or 1. */
  compare(other: Rational): -1 | 0 | 1 {
    return Math.sign(safe(this.n * other.d) - safe(other.n * this.d)) as -1 | 0 | 1;
  }

  sign(): -1 | 0 | 1 {
    return Math.sign(this.n) as -1 | 0 | 1;
  }

  isZero(): boolean {
    return this.n === 0;
  }

  isInteger(): boolean {
    return this.d === 1;
  }

  toString(): string {
    return this.d === 1 ? `${this.n}` : `${this.n}/${this.d}`;
  }

  toJSON(): string {
    return this.toString();
  }
}
