import { Rational } from '@/lib/core/rational';
import type { Item, Level, Matrix } from '@/lib/core/types';
import { validateItem, type ValidationFailure, type ValidationResult } from '@/lib/core/validate';
import { add, det, det2, equals, identity, mul, sameShape, sarrusLines, shape } from './ops';
import type { SkillId } from './skills';
import type { MatrixData, MatrixItem } from './types';

type Span = [min: number, max: number];

/** Allowed cell values per level, from SPEC §3. Where it names no range, the value is our choice. */
const GRID_RANGE: Record<SkillId, Partial<Record<Level, Span>>> = {
  dim: { 1: [1, 9], 2: [1, 9], 3: [1, 9] },
  index: { 1: [1, 9], 2: [1, 20], 3: [-9, 9] },
  transpose: { 1: [1, 9], 2: [1, 9], 3: [-9, 9] },
  addsub: { 1: [0, 9], 2: [-9, 9], 3: [-9, 9] },
  scalar: { 1: [1, 9], 2: [-9, 9], 3: [-5, 5] },
  mult_defined: {},
  mult: { 1: [0, 5], 2: [-5, 5], 3: [-4, 6] },
  mult_noncomm: { 2: [-5, 5], 3: [-6, 8] },
  det2: { 1: [0, 9], 2: [-9, 9] },
  det3: { 1: [0, 5], 2: [-3, 5], 3: [-4, 6] },
  det_props: { 2: [-5, 5] },
  invertible: { 1: [1, 9], 2: [-9, 9], 3: [-4, 8] },
  inv2: { 1: [1, 9], 2: [-9, 9], 3: [-9, 9] },
};

/** MISCONCEPTIONS §2 rule 5 sets L1–L2. It names no L3 limit, so L3 only keeps results workable by hand. */
const LIMITS: Record<Level, { subproduct: number; result: number }> = {
  1: { subproduct: 60, result: 150 },
  2: { subproduct: 60, result: 150 },
  3: { subproduct: 216, result: 300 },
};

const MAX_INVERSE_DENOMINATOR = 12;

const entries = (A: Matrix): Rational[] => A.flat();
const isNegative = (r: Rational): boolean => r.sign() < 0;
const hasNegative = (A: Matrix): boolean => entries(A).some(isNegative);
const countZeros = (A: Matrix): number => entries(A).filter((r) => r.isZero()).length;
const allDistinct = (A: Matrix): boolean =>
  new Set(entries(A).map((r) => r.toString())).size === entries(A).length;

function shownMatrices(data: MatrixData): Matrix[] {
  switch (data.form) {
    case 'dim':
    case 'index':
    case 'transpose':
    case 'scalar':
    case 'det2':
    case 'det3':
    case 'invertible':
    case 'inv2':
      return [data.A];
    case 'addsub':
    case 'combo':
    case 'mult':
    case 'noncomm_find_ba':
    case 'noncomm_pair':
    case 'det_sum':
      return [data.A, data.B];
    default:
      return [];
  }
}

function dotTerms(A: Matrix, B: Matrix): Rational[] {
  return A.flatMap((row) => B[0].flatMap((_, j) => row.map((cell, k) => cell.mul(B[k][j]))));
}

function diagonalProducts([[a, b], [c, d]]: Matrix): Rational[] {
  return [a.mul(d), b.mul(c)];
}

/** Every partial product a student works out by hand on the way to the answer. */
function subproducts(data: MatrixData): Rational[] {
  switch (data.form) {
    case 'scalar':
      return entries(data.A).map((cell) => cell.mul(Rational.of(data.k)));
    case 'combo':
      return [
        ...entries(data.A).map((cell) => cell.mul(Rational.of(data.p))),
        ...entries(data.B).map((cell) => cell.mul(Rational.of(data.q))),
      ];
    case 'mult':
      return dotTerms(data.A, data.B);
    case 'noncomm_find_ba':
      return dotTerms(data.B, data.A);
    case 'noncomm_pair':
      return [...dotTerms(data.A, data.B), ...dotTerms(data.B, data.A)];
    case 'det2':
    case 'inv2':
      return diagonalProducts(data.A);
    case 'det3':
      return [...sarrusLines(data.A).down, ...sarrusLines(data.A).up];
    case 'det_sum':
      return diagonalProducts(add(data.A, data.B));
    case 'det_product':
      return [Rational.of(data.p).mul(Rational.of(data.q))];
    case 'invertible':
      if (data.A.length === 2) return diagonalProducts(data.A);
      return [...sarrusLines(data.A).down, ...sarrusLines(data.A).up];
    default:
      return [];
  }
}

/** The values a student must reach, including the determinant behind a choice. */
function results(item: MatrixItem): Rational[] {
  const { correct, data } = item;
  if (correct.kind === 'matrix') return correct.value.flat();
  if (correct.kind === 'scalar') return [correct.value];
  if (data.form === 'invertible') return [det(data.A)];
  if (data.form === 'noncomm_pair') {
    return [...mul(data.A, data.B).flat(), ...mul(data.B, data.A).flat()];
  }
  return [];
}

const exceeds = (value: Rational, limit: number): boolean =>
  value.abs().compare(Rational.of(limit)) > 0;

function fail(rule: 5 | 6, detail: string): ValidationFailure {
  return { rule, detail };
}

function checkShape(data: MatrixData, level: Level): string | null {
  const dimsOf = (A: Matrix) => `${shape(A).rows}×${shape(A).cols}`;
  switch (data.form) {
    case 'dim': {
      const { rows, cols } = shape(data.A);
      if (level === 1 && dimsOf(data.A) !== '2×3' && dimsOf(data.A) !== '3×2')
        return 'dim L1 is 2×3 or 3×2';
      if (level === 2 && (rows < 2 || rows > 4 || cols < 2 || cols > 4))
        return 'dim L2 is up to 4×4';
      if (level === 3 && !(rows === 1 || cols === 1)) return 'dim L3 is 1×n or n×1';
      return null;
    }
    case 'index':
      if (dimsOf(data.A) !== { 1: '3×3', 2: '3×4', 3: '4×3' }[level])
        return 'index has the wrong shape';
      if (!allDistinct(data.A)) return 'index values must be distinct';
      if (level === 3 && !hasNegative(data.A)) return 'index L3 has negatives';
      return null;
    case 'transpose':
      if (!allDistinct(data.A)) return 'transpose values must be distinct';
      if (level === 1 && dimsOf(data.A) !== '2×2') return 'transpose L1 is 2×2';
      if (level === 2 && dimsOf(data.A) !== '2×3' && dimsOf(data.A) !== '3×2')
        return 'transpose L2 is 2×3 or 3×2';
      if (level === 3 && (dimsOf(data.A) !== '3×3' || !hasNegative(data.A)))
        return 'transpose L3 is 3×3 with negatives';
      return null;
    case 'addsub': {
      const same = sameShape(data.A, data.B);
      if (level === 1 && (!same || dimsOf(data.A) !== '2×2' || data.op !== 'add'))
        return 'addsub L1 adds 2×2';
      if (
        level === 2 &&
        same &&
        (data.op !== 'sub' || !(hasNegative(data.A) || hasNegative(data.B)))
      )
        return 'addsub L2 subtracts with negatives';
      if (level === 3 && same && dimsOf(data.A) !== '3×3') return 'addsub L3 is 3×3';
      return null;
    }
    case 'scalar':
      if (level === 1 && ![2, 3].includes(data.k)) return 'scalar L1 has k in {2,3}';
      if (level === 2 && ![-3, -2, 2, 3, 4].includes(data.k))
        return 'scalar L2 has k in {−3,−2,2,3,4}';
      if (level === 2 && !hasNegative(data.A)) return 'scalar L2 has negatives';
      if (level === 3) return 'scalar L3 is 2A − 3B';
      return null;
    case 'combo':
      return level === 3 ? null : 'combo is scalar L3';
    case 'mult_defined':
      return level === 3 ? 'mult_defined L3 is ABC' : null;
    case 'mult_defined_abc':
      return level === 3 ? null : 'ABC is mult_defined L3';
    case 'mult': {
      const pair = `${dimsOf(data.A)}·${dimsOf(data.B)}`;
      const allowed = { 1: ['2×2·2×2'], 2: ['2×2·2×2', '2×3·3×2'], 3: ['3×3·3×1', '2×3·3×3'] };
      return allowed[level].includes(pair) ? null : `mult L${level} cannot use ${pair}`;
    }
    case 'noncomm_statement':
      return level === 1 ? null : 'statements are mult_noncomm L1';
    case 'noncomm_find_ba':
      if (level !== 2) return 'find BA is mult_noncomm L2';
      return equals(data.AB, mul(data.A, data.B)) ? null : 'the AB shown is wrong';
    case 'noncomm_pair':
      return level === 3 ? null : 'pairs are mult_noncomm L3';
    case 'det2':
      if (level === 1 && det2(data.A).sign() <= 0) return 'det2 L1 has det > 0';
      if (level === 2 && !hasNegative(data.A)) return 'det2 L2 has negatives';
      if (det2(data.A).isZero()) return 'det2 needs det ≠ 0, or M12 cannot show';
      return null;
    case 'det3': {
      const zeros = countZeros(data.A);
      if (level === 1 && zeros < 2) return 'det3 L1 has at least 2 zeros';
      if (level === 2 && zeros !== 1) return 'det3 L2 has exactly 1 zero';
      return null;
    }
    case 'det_scaled':
      if (level === 1 && data.n !== 2) return 'det(kA) L1 has n = 2';
      if (level === 2 && data.n !== 3) return 'det(kA) L2 has n = 3';
      if (level === 3) return 'L3 has no det(kA)';
      return null;
    case 'det_product':
    case 'det_sum':
      return level === 2 ? null : 'det(AB) and det(A+B) are det_props L2';
    case 'det_transpose':
    case 'det_inverse':
      return level === 3 ? null : 'det(Aᵀ) and det(A⁻¹) are det_props L3';
    case 'invertible': {
      const zeros = countZeros(data.A);
      if (level === 1 && (dimsOf(data.A) !== '2×2' || zeros > 0))
        return 'invertible L1 is 2×2 with no zero';
      if (level === 2 && (dimsOf(data.A) !== '2×2' || zeros === 0))
        return 'invertible L2 is 2×2 with a zero';
      if (level === 3 && dimsOf(data.A) !== '3×3') return 'invertible L3 is 3×3';
      return null;
    }
    case 'inv2': {
      const det = det2(data.A);
      if (level === 1 && det.abs().compare(Rational.ONE) !== 0) return 'inv2 L1 has det = ±1';
      if (level === 2 && (det.abs().compare(Rational.of(2)) < 0 || exceeds(det, 5)))
        return 'inv2 L2 has |det| 2–5';
      if (level === 3 && det.sign() >= 0) return 'inv2 L3 has det < 0';
      return null;
    }
  }
}

function checkInverse(item: MatrixItem): ValidationFailure | null {
  const { data, correct } = item;
  if (data.form === 'inv2') {
    if (det2(data.A).isZero()) return fail(6, 'inverse item has det = 0');
    if (correct.kind !== 'matrix' || !equals(mul(data.A, correct.value), identity(2))) {
      return fail(6, 'A·A⁻¹ is not I');
    }
    if (correct.value.flat().some((cell) => cell.d > MAX_INVERSE_DENOMINATOR)) {
      return fail(5, `inverse has a denominator above ${MAX_INVERSE_DENOMINATOR}`);
    }
    if (item.ref.difficulty === 3 && correct.value.flat().every((cell) => cell.isInteger())) {
      return fail(5, 'inv2 L3 must give a fraction');
    }
  }
  if (data.form === 'det_inverse' && correct.kind === 'scalar') {
    if (correct.value.d > MAX_INVERSE_DENOMINATOR) {
      return fail(5, `det(A⁻¹) has a denominator above ${MAX_INVERSE_DENOMINATOR}`);
    }
  }
  if (data.form === 'invertible') {
    const expected = det(data.A).isZero() ? 'no_inverse' : 'has_inverse';
    if (correct.kind !== 'choice' || correct.id !== expected) {
      return fail(6, 'answer disagrees with det');
    }
  }
  return null;
}

/** MISCONCEPTIONS §2 rules 5 and 6. */
function matrixRules(item: Item): ValidationFailure | null {
  const matrixItem = item as MatrixItem;
  const { data, ref } = matrixItem;
  const level = ref.difficulty;

  const span = GRID_RANGE[ref.skill][level];
  if (span) {
    const [min, max] = span;
    for (const shown of shownMatrices(data)) {
      for (const cell of entries(shown)) {
        if (cell.compare(Rational.of(min)) < 0 || cell.compare(Rational.of(max)) > 0) {
          return fail(5, `${cell} is outside ${min}..${max} for ${ref.skill} L${level}`);
        }
      }
    }
  }

  const shapeProblem = checkShape(data, level);
  if (shapeProblem) return fail(5, shapeProblem);

  const limits = LIMITS[level];
  for (const value of subproducts(data)) {
    if (exceeds(value, limits.subproduct)) {
      return fail(5, `subproduct ${value} exceeds ${limits.subproduct}`);
    }
  }
  for (const value of results(matrixItem)) {
    if (exceeds(value, limits.result)) {
      return fail(5, `result ${value} exceeds ${limits.result}`);
    }
  }

  return checkInverse(matrixItem);
}

export function validateMatrixItem(item: MatrixItem): ValidationResult {
  return validateItem(item, matrixRules);
}
