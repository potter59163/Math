import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { Rational } from '@/lib/core/rational';
import { Surd } from '@/lib/core/surd';
import {
  add,
  angleOf,
  cosAngle,
  cosOf,
  cross,
  dot,
  equals,
  isParallel,
  neg,
  norm,
  normSq,
  scale,
  sinOf,
  sub,
  triple,
  unit,
  vec,
  type Vec,
} from './ops';
import { STANDARD_ANGLES } from './types';

// Every number here is copied from docs/VECTORS.md §4. If code disagrees, the code is wrong.

const s = (text: string) => Surd.parse(text);
const surds = (...parts: string[]) => parts.map(s);

describe('the §4 examples', () => {
  const u = vec(2, -1, 3);
  const v = vec(1, 4, -2);

  it('V05: A(1, −2, 3), B(4, 2, −1) → AB = B − A = (3, 4, −4)', () => {
    expect(sub(vec(4, 2, -1), vec(1, -2, 3))).toEqual(vec(3, 4, -4));
  });

  it('V06/V07: 3u − 2v = (4, −11, 13) and 3u + 2v = (8, 5, 5)', () => {
    const three = Rational.of(3);
    const two = Rational.of(2);
    expect(sub(scale(three, u), scale(two, v))).toEqual(vec(4, -11, 13));
    expect(add(scale(three, u), scale(two, v))).toEqual(vec(8, 5, 5));
  });

  it('V09: |(1, −4, 1)| = √18 = 3√2', () => {
    expect(normSq(vec(1, -4, 1))).toEqual(Rational.of(18));
    expect(norm(vec(1, -4, 1))).toEqual(s('3√2'));
  });

  it('V11: u = (1, 2, 2), v = (2, −2, 1) → u + v = (3, 0, 3), |u + v| = 3√2, |u| = |v| = 3', () => {
    const a = vec(1, 2, 2);
    const b = vec(2, -2, 1);
    expect(add(a, b)).toEqual(vec(3, 0, 3));
    expect(norm(add(a, b))).toEqual(s('3√2'));
    expect(norm(a)).toEqual(s('3'));
    expect(norm(b)).toEqual(s('3'));
  });

  it('V12: unit (1, 2, 2) = (1/3, 2/3, 2/3) and unit (1, −1, 2) = (√6/6, −√6/6, √6/3)', () => {
    expect(unit(vec(1, 2, 2))).toEqual(surds('1/3', '2/3', '2/3'));
    expect(unit(vec(1, -1, 2))).toEqual(surds('1/6√6', '-1/6√6', '1/3√6'));
  });

  it('V14: (3, −2)·(4, 5) = 2', () => {
    expect(dot(vec(3, -2), vec(4, 5))).toEqual(Rational.of(2));
  });

  it('V15/V16: cos 60° = 1/2, sin 60° = √3/2, cos 135° = −√2/2, sin 135° = √2/2', () => {
    expect(cosOf(60)).toEqual(s('1/2'));
    expect(sinOf(60)).toEqual(s('1/2√3'));
    expect(cosOf(135)).toEqual(s('-1/2√2'));
    expect(sinOf(135)).toEqual(s('1/2√2'));
  });

  it('V17: (1, 1, 0) and (−1, 0, 1) → u·v = −1, cos θ = −1/2, θ = 120°', () => {
    const a = vec(1, 1, 0);
    const b = vec(-1, 0, 1);
    expect(dot(a, b)).toEqual(Rational.of(-1));
    expect(cosAngle(a, b)).toEqual(s('-1/2'));
    expect(angleOf(a, b)).toBe(120);
  });

  it('V18: (1, 2) and (3, 1) → cos θ = 5/√50 = √2/2, θ = 45°', () => {
    expect(cosAngle(vec(1, 2), vec(3, 1))).toEqual(s('1/2√2'));
    expect(angleOf(vec(1, 2), vec(3, 1))).toBe(45);
  });

  it('V20: u × v = (−10, 7, 9)', () => {
    expect(cross(u, v)).toEqual(vec(-10, 7, 9));
  });

  it('V23: AB = (1, 2, 0), AC = (3, 1, 2) → AB × AC = (4, −2, −5), |AB × AC| = 3√5', () => {
    const ab = vec(1, 2, 0);
    const ac = vec(3, 1, 2);
    expect(cross(ab, ac)).toEqual(vec(4, -2, -5));
    expect(norm(cross(ab, ac))).toEqual(s('3√5'));
    expect(dot(ab, ac)).toEqual(Rational.of(5));
  });

  it('V25: v × w = (−1, −6, 2) and u·(v × w) = −13', () => {
    const a = vec(1, 2, 0);
    const b = vec(2, 0, 1);
    const c = vec(0, 1, 3);
    expect(cross(b, c)).toEqual(vec(-1, -6, 2));
    expect(triple(a, b, c)).toEqual(Rational.of(-13));
  });

  it('V26: |u||v||w| = √5·√5·√10 = 5√10', () => {
    const product = norm(vec(1, 2, 0))
      .mul(norm(vec(2, 0, 1)))
      .mul(norm(vec(0, 1, 3)));
    expect(product).toEqual(s('5√10'));
  });
});

describe('standard angles', () => {
  it('give cos² + sin² = 1 at every angle, exactly', () => {
    for (const theta of STANDARD_ANGLES) {
      expect(cosOf(theta).square().add(sinOf(theta).square())).toEqual(Rational.ONE);
    }
  });

  it('read back from their cosine', () => {
    expect(angleOf(vec(1, 0), vec(1, 0))).toBe(0);
    expect(angleOf(vec(1, 0), vec(0, 1))).toBe(90);
    expect(angleOf(vec(1, 0), vec(-1, 0))).toBe(180);
    expect(angleOf(vec(2, 1, 1), vec(1, 1, 0))).toBe(30);
  });

  it('give null for an angle that is not standard', () => {
    expect(angleOf(vec(1, 2), vec(2, 1))).toBeNull();
  });
});

const component = fc.integer({ min: -9, max: 9 });
const vec3 = fc.tuple(component, component, component).map((parts) => vec(...parts));
const vec2 = fc.tuple(component, component).map((parts) => vec(...parts));
const nonZero3 = vec3.filter((v) => v.some((part) => !part.isZero()));
// Items keep components small; with 9s the squared cosine needs parts past 1e9, which Rational refuses.
const small = fc.integer({ min: -5, max: 5 });
const smallNonZero3 = fc
  .tuple(small, small, small)
  .map((parts) => vec(...parts))
  .filter((v) => v.some((part) => !part.isZero()));

describe('properties', () => {
  it('u × v is perpendicular to u and to v', () => {
    fc.assert(
      fc.property(vec3, vec3, (u, v) => {
        const w = cross(u, v);
        expect(dot(w, u).isZero()).toBe(true);
        expect(dot(w, v).isZero()).toBe(true);
      }),
    );
  });

  it('|u × v|² + (u·v)² = |u|²|v|²', () => {
    fc.assert(
      fc.property(vec3, vec3, (u, v) => {
        const d = dot(u, v);
        expect(normSq(cross(u, v)).add(d.mul(d))).toEqual(normSq(u).mul(normSq(v)));
      }),
    );
  });

  it('u·v = v·u', () => {
    fc.assert(
      fc.property(vec3, vec3, (u, v) => {
        expect(dot(u, v)).toEqual(dot(v, u));
      }),
    );
  });

  it('v × u = −(u × v)', () => {
    fc.assert(
      fc.property(vec3, vec3, (u, v) => {
        expect(equals(cross(v, u), neg(cross(u, v)))).toBe(true);
      }),
    );
  });

  it('a unit vector has length 1, and |v| squared is |v|²', () => {
    fc.assert(
      fc.property(nonZero3, (v) => {
        const length = unit(v).reduce((total, part) => total.add(part.square()), Rational.ZERO);
        expect(length).toEqual(Rational.ONE);
        expect(norm(v).square()).toEqual(normSq(v));
      }),
    );
  });

  it('u·(v × w) changes sign when v and w swap', () => {
    fc.assert(
      fc.property(vec3, vec3, vec3, (u, v, w) => {
        expect(triple(u, w, v)).toEqual(triple(u, v, w).neg());
      }),
    );
  });

  it('cos θ squared is (u·v)² / (|u|²|v|²), with no float', () => {
    fc.assert(
      fc.property(smallNonZero3, smallNonZero3, (u, v) => {
        const d = dot(u, v);
        expect(cosAngle(u, v).square()).toEqual(d.mul(d).div(normSq(u).mul(normSq(v))));
        expect(cosAngle(u, v).sign()).toBe(d.sign());
      }),
    );
  });

  it('parallel means the 2D determinant (or cross product) is zero', () => {
    fc.assert(
      fc.property(vec2, fc.integer({ min: -4, max: 4 }), (v, k) => {
        expect(isParallel(v, scale(Rational.of(k), v))).toBe(true);
      }),
    );
  });
});

describe('guards', () => {
  it('refuses vectors of different sizes', () => {
    expect(() => add(vec(1, 2), vec(1, 2, 3))).toThrow(/size/);
    expect(() => dot(vec(1, 2), vec(1, 2, 3) as Vec)).toThrow(/size/);
  });

  it('crosses only 3D vectors', () => {
    expect(() => cross(vec(1, 2), vec(3, 4))).toThrow(/3D/);
  });

  it('has no unit vector or angle for the zero vector', () => {
    expect(() => unit(vec(0, 0, 0))).toThrow(/zero/);
    expect(() => cosAngle(vec(0, 0), vec(1, 0))).toThrow(/zero/);
  });
});
