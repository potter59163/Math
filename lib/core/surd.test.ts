import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { Rational } from './rational';
import { Surd, surdLatex, surdText } from './surd';

const RUNS = { numRuns: 1000 };

const part = fc.integer({ min: -60, max: 60 });
const nonZeroPart = part.filter((n) => n !== 0);
const rational = fc.tuple(part, nonZeroPart).map(([n, d]) => Rational.of(n, d));
const radicand = fc.integer({ min: 1, max: 300 });
const surd = fc.tuple(rational, radicand).map(([c, r]) => Surd.of(c, r));
const nonZeroSurd = surd.filter((s) => !s.isZero());

function isSquarefree(n: number): boolean {
  for (let p = 2; p * p <= n; p += 1) if (n % (p * p) === 0) return false;
  return true;
}

describe('Surd.of', () => {
  it('takes squares out of the root', () => {
    expect(Surd.of(1, 18).toString()).toBe('3√2');
    expect(Surd.of(2, 8).toString()).toBe('4√2');
    expect(Surd.of(1, 49).toString()).toBe('7');
    expect(Surd.of(Rational.of(1, 2), 12).toString()).toBe('√3');
  });

  it('makes zero have radicand 1', () => {
    const zero = Surd.of(0, 7);
    expect([zero.coeff.toString(), zero.radicand]).toEqual(['0', 1]);
    expect(zero.equals(Surd.ZERO)).toBe(true);
  });

  it('rejects radicands that are not positive integers', () => {
    expect(() => Surd.of(1, 0)).toThrow(RangeError);
    expect(() => Surd.of(1, -2)).toThrow(RangeError);
    expect(() => Surd.of(1, 2.5)).toThrow(RangeError);
  });

  it('always ends squarefree, and simplifying again changes nothing', () => {
    fc.assert(
      fc.property(surd, (s) => {
        expect(isSquarefree(s.radicand)).toBe(true);
        expect(Surd.of(s.coeff, s.radicand).equals(s)).toBe(true);
      }),
      RUNS,
    );
  });
});

describe('Surd.sqrt', () => {
  it('matches the worked examples of docs/VECTORS.md §3', () => {
    expect(Surd.sqrt(18).toString()).toBe('3√2');
    expect(Surd.sqrt(45).toString()).toBe('3√5');
    expect(Surd.sqrt(Rational.of(1, 2)).equals(Surd.of(Rational.of(1, 2), 2))).toBe(true);
    expect(Surd.ONE.div(Surd.sqrt(2)).equals(Surd.of(Rational.of(1, 2), 2))).toBe(true);
    expect(
      Surd.rational(5)
        .div(Surd.sqrt(50))
        .equals(Surd.of(Rational.of(1, 2), 2)),
    ).toBe(true);
    expect(Surd.sqrt(9).equals(Surd.rational(3))).toBe(true);
  });

  it('squares back to what went in', () => {
    fc.assert(
      fc.property(rational, (q) => {
        expect(Surd.sqrt(q.abs()).square().equals(q.abs())).toBe(true);
        expect(Surd.sqrt(q.abs()).sign()).toBeGreaterThanOrEqual(0);
      }),
      RUNS,
    );
  });

  it('refuses a negative', () => {
    expect(() => Surd.sqrt(-1)).toThrow(RangeError);
  });
});

describe('arithmetic', () => {
  it('multiplies roots together', () => {
    expect(Surd.sqrt(2).mul(Surd.sqrt(3)).toString()).toBe('√6');
    expect(Surd.sqrt(2).mul(Surd.sqrt(2)).toString()).toBe('2');
    expect(Surd.sqrt(5).mul(Surd.sqrt(5)).mul(Surd.sqrt(10)).toString()).toBe('5√10');
  });

  it('squares to a rational', () => {
    fc.assert(
      fc.property(surd, (s) => {
        expect(s.mul(s).isRational()).toBe(true);
        expect(s.mul(s).toRational().equals(s.square())).toBe(true);
      }),
      RUNS,
    );
  });

  it('undoes a multiplication with a division', () => {
    fc.assert(
      fc.property(surd, nonZeroSurd, (a, b) => {
        expect(a.mul(b).div(b).equals(a)).toBe(true);
      }),
      RUNS,
    );
  });

  it('multiplies in either order', () => {
    fc.assert(
      fc.property(surd, surd, (a, b) => {
        expect(a.mul(b).equals(b.mul(a))).toBe(true);
      }),
      RUNS,
    );
  });

  it('adds only like roots', () => {
    expect(Surd.sqrt(8).addSame(Surd.sqrt(2))?.toString()).toBe('3√2');
    expect(Surd.sqrt(2).addSame(Surd.sqrt(5))).toBeNull();
    expect(Surd.ZERO.addSame(Surd.sqrt(5))?.toString()).toBe('√5');
    expect(Surd.sqrt(3).addSame(Surd.sqrt(3).neg())?.equals(Surd.ZERO)).toBe(true);
  });

  it('refuses to divide by zero', () => {
    expect(() => Surd.ONE.div(Surd.ZERO)).toThrow(RangeError);
  });

  it('fails loudly instead of overflowing', () => {
    const big = Surd.of(Rational.of(999_999_937), 2);
    expect(() => big.mul(big).mul(big)).toThrow(RangeError);
  });
});

describe('comparison', () => {
  it('orders by value without floats', () => {
    expect(Surd.sqrt(2).compare(Surd.rational(Rational.of(3, 2)))).toBe(-1);
    expect(Surd.sqrt(3).compare(Surd.sqrt(2))).toBe(1);
    expect(Surd.sqrt(2).neg().compare(Surd.sqrt(3).neg())).toBe(1);
    expect(Surd.sqrt(2).neg().compare(Surd.ZERO)).toBe(-1);
  });

  it('agrees with equals and is antisymmetric', () => {
    fc.assert(
      fc.property(surd, surd, (a, b) => {
        expect(a.compare(b) === 0).toBe(a.equals(b));
        expect(a.compare(b) + b.compare(a)).toBe(0);
        expect(a.equals(b)).toBe(b.equals(a));
      }),
      RUNS,
    );
  });
});

describe('text', () => {
  it('prints and reads back the canonical form', () => {
    expect(Surd.of(Rational.of(-3, 2), 2).toString()).toBe('-3/2√2');
    expect(Surd.sqrt(2).neg().toString()).toBe('-√2');
    fc.assert(
      fc.property(surd, (s) => {
        expect(Surd.parse(s.toString()).equals(s)).toBe(true);
        expect(JSON.parse(JSON.stringify({ s }))).toEqual({ s: s.toString() });
      }),
      RUNS,
    );
  });

  it('shows students the textbook form with a typographic minus', () => {
    expect(surdText(Surd.of(Rational.of(3, 2), 5))).toBe('3√5/2');
    expect(surdText(Surd.of(Rational.of(-1, 2), 3))).toBe('−√3/2');
    expect(surdText(Surd.rational(Rational.of(-3, 2)))).toBe('−3/2');
    expect(surdText(Surd.sqrt(6))).toBe('√6');
  });

  it('writes KaTeX', () => {
    expect(surdLatex(Surd.of(Rational.of(-1, 2), 3))).toBe('-\\frac{\\sqrt{3}}{2}');
    expect(surdLatex(Surd.of(3, 2))).toBe('3\\sqrt{2}');
    expect(surdLatex(Surd.rational(Rational.of(5, 2)))).toBe('\\frac{5}{2}');
  });
});

describe('Surd.parse on forged text', () => {
  it('refuses a radicand longer than any it prints, before simplifying it', () => {
    expect(() => Surd.parse('√99999999999989')).toThrow(RangeError);
    expect(() => Surd.parse('-3/2√12345678')).toThrow(RangeError);
    expect(Surd.parse('√999999').toString()).toBe('3√111111');
  });
});
