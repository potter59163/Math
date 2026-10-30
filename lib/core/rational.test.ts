import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { Rational } from './rational';

const part = fc.integer({ min: -200, max: 200 });
const nonZeroPart = part.filter((n) => n !== 0);
const rational = fc.tuple(part, nonZeroPart).map(([n, d]) => Rational.of(n, d));
const nonZeroRational = rational.filter((r) => !r.isZero());

function gcd(a: number, b: number): number {
  return b === 0 ? Math.abs(a) : gcd(b, a % b);
}

describe('Rational.of', () => {
  it('reduces by gcd', () => {
    const half = Rational.of(2, 4);
    expect([half.n, half.d]).toEqual([1, 2]);
  });

  it('keeps the denominator positive', () => {
    const a = Rational.of(3, -6);
    expect([a.n, a.d]).toEqual([-1, 2]);
    const b = Rational.of(-3, -6);
    expect([b.n, b.d]).toEqual([1, 2]);
  });

  it('never produces negative zero', () => {
    for (const zero of [
      Rational.of(0, -5),
      Rational.of(0).neg(),
      Rational.of(1).sub(Rational.of(1)),
    ]) {
      expect(Object.is(zero.n, 0)).toBe(true);
      expect(zero.d).toBe(1);
    }
    expect(Rational.of(0).mul(Rational.of(-3)).toString()).toBe('0');
  });

  it('throws on a zero denominator', () => {
    expect(() => Rational.of(1, 0)).toThrow(RangeError);
  });

  it.each([
    [1.5, 1],
    [1, 0.5],
    [Number.NaN, 1],
    [Number.POSITIVE_INFINITY, 1],
    [2 ** 53, 1],
  ])('throws on non-safe-integer parts (%d, %d)', (n, d) => {
    expect(() => Rational.of(n, d)).toThrow(RangeError);
  });

  it('throws when a reduced part exceeds 1e9', () => {
    expect(() => Rational.of(1_000_000_001)).toThrow(RangeError);
    expect(() => Rational.of(1, 1_000_000_001)).toThrow(RangeError);
    expect(Rational.of(1_000_000_000).n).toBe(1_000_000_000);
    expect(Rational.of(2_000_000_000, 2).n).toBe(1_000_000_000);
  });

  it('is always canonical', () => {
    fc.assert(
      fc.property(part, nonZeroPart, (n, d) => {
        const r = Rational.of(n, d);
        expect(r.d).toBeGreaterThan(0);
        expect(gcd(r.n, r.d)).toBe(1);
      }),
    );
  });
});

describe('Rational arithmetic', () => {
  it('computes exact fractions', () => {
    const half = Rational.of(1, 2);
    const third = Rational.of(1, 3);
    expect(half.add(third)).toEqual(Rational.of(5, 6));
    expect(half.sub(third)).toEqual(Rational.of(1, 6));
    expect(Rational.of(2, 3).mul(Rational.of(3, 4))).toEqual(half);
    expect(half.div(Rational.of(1, 4))).toEqual(Rational.of(2));
    expect(Rational.of(-2, 3).inv()).toEqual(Rational.of(-3, 2));
    expect(Rational.of(-2, 3).abs()).toEqual(Rational.of(2, 3));
    expect(Rational.of(-2, 3).neg()).toEqual(Rational.of(2, 3));
  });

  it('adds without float error: 1/10 + 2/10 is exactly 3/10', () => {
    expect(Rational.of(1, 10).add(Rational.of(2, 10))).toEqual(Rational.of(3, 10));
  });

  it('raises to non-negative integer powers', () => {
    expect(Rational.of(-2, 3).pow(3)).toEqual(Rational.of(-8, 27));
    expect(Rational.of(5).pow(0)).toEqual(Rational.of(1));
    expect(() => Rational.of(2).pow(-1)).toThrow(RangeError);
    expect(() => Rational.of(2).pow(0.5)).toThrow(RangeError);
  });

  it('throws on division by zero', () => {
    expect(() => Rational.of(0).inv()).toThrow(RangeError);
    expect(() => Rational.of(1).div(Rational.of(0))).toThrow(RangeError);
  });

  it('throws instead of losing precision', () => {
    const big = Rational.of(1_000_000_000);
    expect(() => big.mul(big)).toThrow(RangeError);
    expect(() => Rational.of(1, 999_999_937).add(Rational.of(1, 999_999_929))).toThrow(RangeError);
  });

  it('obeys the field laws', () => {
    fc.assert(
      fc.property(rational, rational, rational, (a, b, c) => {
        expect(a.add(b)).toEqual(b.add(a));
        expect(a.mul(b)).toEqual(b.mul(a));
        expect(a.add(b).add(c)).toEqual(a.add(b.add(c)));
        expect(a.mul(b).mul(c)).toEqual(a.mul(b.mul(c)));
        expect(a.mul(b.add(c))).toEqual(a.mul(b).add(a.mul(c)));
        expect(a.sub(a)).toEqual(Rational.ZERO);
        expect(a.add(b).sub(b)).toEqual(a);
      }),
    );
  });

  it('has multiplicative inverses', () => {
    fc.assert(
      fc.property(nonZeroRational, rational, (a, b) => {
        expect(a.mul(a.inv())).toEqual(Rational.ONE);
        expect(b.mul(a).div(a)).toEqual(b);
      }),
    );
  });
});

describe('Rational comparison', () => {
  it('equals compares by value', () => {
    expect(Rational.of(2, 4).equals(Rational.of(1, 2))).toBe(true);
    expect(Rational.of(1, 2).equals(Rational.of(-1, 2))).toBe(false);
  });

  it('compare is antisymmetric and agrees with sub', () => {
    fc.assert(
      fc.property(rational, rational, (a, b) => {
        expect(a.compare(b)).toBe(a.sub(b).sign());
        expect(a.compare(b)).toBe(-b.compare(a) + 0);
        expect(a.equals(b)).toBe(a.compare(b) === 0);
      }),
    );
  });

  it('knows its sign and whether it is an integer', () => {
    expect(Rational.of(-2, 3).sign()).toBe(-1);
    expect(Rational.ZERO.sign()).toBe(0);
    expect(Rational.of(2, 3).sign()).toBe(1);
    expect(Rational.of(4, 2).isInteger()).toBe(true);
    expect(Rational.of(1, 2).isInteger()).toBe(false);
  });
});

describe('Rational serialization', () => {
  it('prints integers and fractions as strings like "-3/2"', () => {
    expect(Rational.of(-3, 2).toString()).toBe('-3/2');
    expect(Rational.of(4).toString()).toBe('4');
    expect(JSON.stringify({ x: Rational.of(-3, 2) })).toBe('{"x":"-3/2"}');
  });

  it('parses what it prints', () => {
    fc.assert(
      fc.property(rational, (r) => {
        expect(Rational.parse(r.toString())).toEqual(r);
      }),
    );
  });

  it.each(['', 'abc', '1.5', '1/0', '1/2/3', ' 1', '--1'])('rejects %j', (text) => {
    expect(() => Rational.parse(text)).toThrow(RangeError);
  });
});
