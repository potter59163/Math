import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { Rational } from '@/lib/core/rational';
import {
  add,
  det2,
  det3,
  equals,
  hadamard,
  identity,
  inv2,
  matrix,
  minor,
  mul,
  sarrusLines,
  scalar,
  shape,
  sub,
  transpose,
} from './ops';

const entry = fc.integer({ min: -9, max: 9 });
const matrixOf = (rows: number, cols: number) =>
  fc
    .array(fc.array(entry, { minLength: cols, maxLength: cols }), {
      minLength: rows,
      maxLength: rows,
    })
    .map((cells) => matrix(cells));

describe('matrix', () => {
  it('builds Rational cells from numbers and strings', () => {
    expect(matrix([[1, '-1/2']])).toEqual([[Rational.of(1), Rational.of(-1, 2)]]);
  });

  it('rejects jagged input', () => {
    expect(() => matrix([[1, 2], [3]])).toThrow();
  });
});

describe('shape and equals', () => {
  it('reads rows × cols', () => {
    expect(shape(matrix([[1, 2, 3]]))).toEqual({ rows: 1, cols: 3 });
  });

  it('compares by value and shape', () => {
    expect(equals(matrix([[1, 2]]), matrix([['2/2', '4/2']]))).toBe(true);
    expect(equals(matrix([[1, 2]]), matrix([[1], [2]]))).toBe(false);
    expect(equals(matrix([[1, 2]]), matrix([[1, 3]]))).toBe(false);
  });
});

describe('add, sub, scalar, hadamard', () => {
  it('reject different shapes', () => {
    expect(() => add(matrix([[1, 2]]), matrix([[1], [2]]))).toThrow();
    expect(() => sub(matrix([[1, 2]]), matrix([[1], [2]]))).toThrow();
    expect(() => hadamard(matrix([[1, 2]]), matrix([[1], [2]]))).toThrow();
  });

  it('A + B − B = A', () => {
    fc.assert(
      fc.property(matrixOf(2, 3), matrixOf(2, 3), (A, B) => {
        expect(sub(add(A, B), B)).toEqual(A);
      }),
    );
  });

  it('A + B = B + A', () => {
    fc.assert(
      fc.property(matrixOf(3, 3), matrixOf(3, 3), (A, B) => {
        expect(add(A, B)).toEqual(add(B, A));
      }),
    );
  });

  it('kA + kB = k(A + B)', () => {
    fc.assert(
      fc.property(entry, matrixOf(2, 2), matrixOf(2, 2), (k, A, B) => {
        const kq = Rational.of(k);
        expect(add(scalar(kq, A), scalar(kq, B))).toEqual(scalar(kq, add(A, B)));
      }),
    );
  });

  it('hadamard multiplies cell by cell', () => {
    expect(hadamard(matrix([[2, 1]]), matrix([[1, 5]]))).toEqual(matrix([[2, 5]]));
  });
});

describe('mul', () => {
  it('rejects non-conformable shapes', () => {
    expect(() => mul(matrix([[1, 2]]), matrix([[1, 2]]))).toThrow();
  });

  it('produces rows(A) × cols(B)', () => {
    const product = mul(
      matrix([
        [1, 2, 3],
        [4, 5, 6],
      ]),
      matrix([
        [1, 0, 2],
        [3, 1, 1],
        [2, 2, 5],
      ]),
    );
    expect(shape(product)).toEqual({ rows: 2, cols: 3 });
    expect(product).toEqual(
      matrix([
        [13, 8, 19],
        [31, 17, 43],
      ]),
    );
  });

  it('is associative', () => {
    fc.assert(
      fc.property(matrixOf(2, 2), matrixOf(2, 3), matrixOf(3, 2), (A, B, C) => {
        expect(mul(mul(A, B), C)).toEqual(mul(A, mul(B, C)));
      }),
    );
  });

  it('has an identity', () => {
    fc.assert(
      fc.property(matrixOf(3, 3), (A) => {
        expect(mul(A, identity(3))).toEqual(A);
        expect(mul(identity(3), A)).toEqual(A);
      }),
    );
  });
});

describe('transpose', () => {
  it('swaps rows and columns', () => {
    expect(
      transpose(
        matrix([
          [1, 2, 3],
          [4, 5, 6],
        ]),
      ),
    ).toEqual(
      matrix([
        [1, 4],
        [2, 5],
        [3, 6],
      ]),
    );
  });

  it('is an involution', () => {
    fc.assert(
      fc.property(matrixOf(2, 3), (A) => {
        expect(transpose(transpose(A))).toEqual(A);
      }),
    );
  });

  it('(AB)ᵀ = BᵀAᵀ', () => {
    fc.assert(
      fc.property(matrixOf(2, 3), matrixOf(3, 2), (A, B) => {
        expect(transpose(mul(A, B))).toEqual(mul(transpose(B), transpose(A)));
      }),
    );
  });
});

describe('det2 and det3', () => {
  it('reject the wrong shape', () => {
    expect(() => det2(identity(3))).toThrow();
    expect(() => det3(identity(2))).toThrow();
  });

  it('det(AB) = det A · det B', () => {
    fc.assert(
      fc.property(matrixOf(2, 2), matrixOf(2, 2), (A, B) => {
        expect(det2(mul(A, B))).toEqual(det2(A).mul(det2(B)));
      }),
    );
    fc.assert(
      fc.property(matrixOf(3, 3), matrixOf(3, 3), (A, B) => {
        expect(det3(mul(A, B))).toEqual(det3(A).mul(det3(B)));
      }),
    );
  });

  it('det(Aᵀ) = det A', () => {
    fc.assert(
      fc.property(matrixOf(3, 3), (A) => {
        expect(det3(transpose(A))).toEqual(det3(A));
      }),
    );
  });

  it('det3 agrees with cofactor expansion along the first row', () => {
    fc.assert(
      fc.property(matrixOf(3, 3), (A) => {
        const expansion = A[0][0]
          .mul(minor(A, 1, 1))
          .sub(A[0][1].mul(minor(A, 1, 2)))
          .add(A[0][2].mul(minor(A, 1, 3)));
        expect(det3(A)).toEqual(expansion);
      }),
    );
  });

  it('det3 is three down lines minus three up lines', () => {
    fc.assert(
      fc.property(matrixOf(3, 3), (A) => {
        const { down, up } = sarrusLines(A);
        const sum = (values: Rational[]) => values.reduce((s, v) => s.add(v), Rational.ZERO);
        expect(det3(A)).toEqual(sum(down).sub(sum(up)));
      }),
    );
  });
});

describe('inv2', () => {
  it('throws on a singular matrix', () => {
    expect(() =>
      inv2(
        matrix([
          [2, 4],
          [1, 2],
        ]),
      ),
    ).toThrow();
  });

  it('A·A⁻¹ = A⁻¹·A = I', () => {
    fc.assert(
      fc.property(
        matrixOf(2, 2).filter((A) => !det2(A).isZero()),
        (A) => {
          expect(mul(A, inv2(A))).toEqual(identity(2));
          expect(mul(inv2(A), A)).toEqual(identity(2));
        },
      ),
    );
  });
});
