import { countDiffComponents } from '@/lib/core/classify';
import { Rational } from '@/lib/core/rational';
import { Surd } from '@/lib/core/surd';
import type { Item, Level } from '@/lib/core/types';
import { validateItem, type ValidationFailure, type ValidationResult } from '@/lib/core/validate';
import { figureKey } from './format';
import {
  angleOf,
  cosAngle,
  cosOf,
  cross,
  crossTerms,
  dot,
  dotTerms,
  equals,
  isParallel,
  isStandardAngle,
  isZeroVec,
  normSq,
  sub,
  triple,
} from './ops';
import type { SkillId } from './skills';
import {
  askedValue,
  crossFactors,
  exprValue,
  isUnknown,
  linearVec,
  parallelK,
  parallelPair,
  partnerOf,
  perpPropertySquare,
  pointAt,
  QUANTITY_KIND,
  quantityMatches,
  solve,
  termValue,
  triangleSides,
  unknownAt,
} from './solve';
import type {
  DataOf,
  Figure,
  Slot,
  Term,
  Vec,
  VectorAnswer,
  VectorData,
  VectorItem,
} from './types';

/** docs/VECTORS.md §2: the size of every number, at every level. */
export const VECTOR_LIMITS = {
  /** |component| of every given vector or point. */
  component: 9,
  /** |product| a student works out on the way, squares included. */
  subproduct: 60,
  /** |value| of every intermediate and final result. */
  result: 150,
  /** Radicand of the answer after simplifying. */
  radicand: 200,
  /** Denominator of the answer. */
  denominator: 12,
} as const;

/** Angles each level of v_angle asks for (L1 asks for cos θ instead). */
export const ANGLE_LEVELS: Record<2 | 3, readonly number[]> = {
  2: [30, 45, 60, 90, 120, 135],
  3: [120, 135, 150],
};

const square = (part: Rational): Surd => Surd.rational(part.mul(part));
const asSurds = (parts: readonly Rational[]): Surd[] => parts.map((part) => Surd.rational(part));
const knownParts = (parts: readonly Slot[]): Rational[] =>
  parts.filter((part): part is Rational => !isUnknown(part));

/** Every number the student is given: components, coordinates and integer constants. */
export function givenNumbers(data: VectorData): Rational[] {
  switch (data.form) {
    case 'quantity_kind':
    case 'figure_equal':
    case 'figure_expr':
      // Figure coordinates are hidden; the student sees only the drawing and the point names.
      return [];
    case 'points':
    case 'distance':
      return [...data.A, ...data.B];
    case 'fourth_vertex':
    case 'area_triangle':
      return [...data.A, ...data.B, ...data.C];
    case 'linear':
    case 'magnitude_combo':
      return data.terms.flatMap(({ k, vec }) => [Rational.of(k), ...vec]);
    case 'parallel':
    case 'perp':
      return [...knownParts(data.u), ...knownParts(data.v)];
    case 'perp_property':
      return [...data.u, ...knownParts(data.v)];
    case 'magnitude':
    case 'unit':
    case 'direction_cosines':
      return data.v;
    case 'scaled_unit':
      return [...data.v, Rational.of(data.length)];
    case 'dot':
    case 'cos_angle':
    case 'angle':
    case 'cross':
    case 'area_parallelogram':
      return [...data.u, ...data.v];
    case 'dot_polar':
      return [];
    case 'volume':
      return [...data.u, ...data.v, ...data.w];
  }
}

/** The vector whose length a magnitude item asks for. */
function measured(data: DataOf<'magnitude' | 'magnitude_combo' | 'distance'>): Vec {
  if (data.form === 'magnitude') return data.v;
  if (data.form === 'magnitude_combo') return linearVec(data.terms);
  return sub(data.B, data.A);
}

const pairProducts = (pairs: [Rational, Rational][]): Surd[] =>
  asSurds(pairs.flatMap(([first, second]) => [first, second]));

/** Every product a student works out by hand on the way to the answer. Squares count too. */
export function subproducts(data: VectorData): Surd[] {
  switch (data.form) {
    case 'linear':
      return asSurds(
        data.terms.flatMap(({ k, vec }) => vec.map((part) => part.mul(Rational.of(k)))),
      );
    case 'parallel':
      return [Surd.rational(parallelK(data).mul(partnerOf(data).partner))];
    case 'magnitude':
    case 'distance':
      return measured(data).map(square);
    case 'magnitude_combo':
      return [
        ...asSurds(data.terms.flatMap(({ k, vec }) => vec.map((part) => part.mul(Rational.of(k))))),
        ...measured(data).map(square),
      ];
    case 'unit':
    case 'scaled_unit':
    case 'direction_cosines':
      return data.v.map(square);
    case 'dot':
      return asSurds(dotTerms(data.u, data.v));
    case 'dot_polar':
      return [data.normU.mul(data.normV)];
    case 'cos_angle':
    case 'angle':
      return [...asSurds(dotTerms(data.u, data.v)), ...data.u.map(square), ...data.v.map(square)];
    case 'perp': {
      const products: Rational[] = [];
      data.u.forEach((part, i) => {
        const other = data.v[i];
        if (!isUnknown(part) && !isUnknown(other)) products.push(part.mul(other));
      });
      return asSurds(products);
    }
    case 'perp_property':
      return [...data.u.map(square), ...knownParts(data.v).map(square)];
    case 'cross':
      return pairProducts(crossTerms(...crossFactors(data)));
    case 'area_parallelogram': {
      const c = cross(data.u, data.v);
      return [...pairProducts(crossTerms(data.u, data.v)), ...c.map(square)];
    }
    case 'area_triangle': {
      const sides = triangleSides(data);
      return [...pairProducts(crossTerms(...sides)), ...cross(...sides).map(square)];
    }
    case 'volume':
      return [
        ...pairProducts(crossTerms(data.v, data.w)),
        ...asSurds(dotTerms(data.u, cross(data.v, data.w))),
      ];
    case 'quantity_kind':
    case 'figure_equal':
    case 'figure_expr':
    case 'points':
    case 'fourth_vertex':
      return [];
  }
}

/** Values a student reaches before the answer: sums of squares, dot products, cross products. */
function intermediates(data: VectorData): Surd[] {
  switch (data.form) {
    case 'magnitude':
    case 'magnitude_combo':
    case 'distance': {
      const w = measured(data);
      return [...asSurds(w), Surd.rational(normSq(w))];
    }
    case 'unit':
    case 'scaled_unit':
    case 'direction_cosines':
      return [Surd.rational(normSq(data.v))];
    case 'cos_angle':
    case 'angle':
      return asSurds([dot(data.u, data.v), normSq(data.u), normSq(data.v)]);
    case 'cross':
      return asSurds(cross(...crossFactors(data)));
    case 'area_parallelogram': {
      const c = cross(data.u, data.v);
      return asSurds([...c, normSq(c)]);
    }
    case 'area_triangle': {
      const sides = triangleSides(data);
      const c = cross(...sides);
      return asSurds([...sides.flat(), ...c, normSq(c)]);
    }
    case 'volume':
      return asSurds([...cross(data.v, data.w), triple(data.u, data.v, data.w)]);
    case 'perp_property':
      return asSurds([normSq(data.u)]);
    default:
      return [];
  }
}

function answerValues(correct: VectorAnswer, data: VectorData): Surd[] {
  switch (correct.kind) {
    case 'surd':
      return [correct.value];
    case 'vector':
      return correct.value;
    case 'scalar':
      // Degrees are not computed by hand; the angle list bounds them.
      return data.form === 'angle' ? [] : [Surd.rational(correct.value)];
    case 'choice':
      return [];
  }
}

const exceeds = (value: Surd, limit: number): boolean =>
  value.square().compare(Rational.of(limit * limit)) > 0;

/** Rule 5 for numbers alone, so generators can redraw before building a whole item. */
export function limitProblem(data: VectorData): string | null {
  let correct: VectorAnswer;
  try {
    correct = solve(data);
  } catch (error) {
    return error instanceof Error ? error.message : 'no answer';
  }
  for (const value of givenNumbers(data)) {
    if (value.abs().compare(Rational.of(VECTOR_LIMITS.component)) > 0) {
      return `given ${value} exceeds ${VECTOR_LIMITS.component}`;
    }
  }
  for (const value of subproducts(data)) {
    if (exceeds(value, VECTOR_LIMITS.subproduct)) {
      return `subproduct ${value} exceeds ${VECTOR_LIMITS.subproduct}`;
    }
  }
  const answers = answerValues(correct, data);
  for (const value of [...intermediates(data), ...answers]) {
    if (exceeds(value, VECTOR_LIMITS.result)) {
      return `result ${value} exceeds ${VECTOR_LIMITS.result}`;
    }
  }
  for (const value of answers) {
    if (value.radicand > VECTOR_LIMITS.radicand) {
      return `radicand ${value.radicand} exceeds ${VECTOR_LIMITS.radicand}`;
    }
    if (value.coeff.d > VECTOR_LIMITS.denominator) {
      return `denominator ${value.coeff.d} exceeds ${VECTOR_LIMITS.denominator}`;
    }
  }
  return null;
}

const zeros = (parts: readonly Rational[]): number => parts.filter((p) => p.isZero()).length;
const hasNegative = (parts: readonly Rational[]): boolean => parts.some((p) => p.sign() < 0);
const sizeOf = (...vectors: readonly (readonly Slot[])[]): number[] => vectors.map((v) => v.length);
const allSize = (n: number, ...vectors: readonly (readonly Slot[])[]): boolean =>
  sizeOf(...vectors).every((size) => size === n);

function checkFigure(figure: Figure, needsMidpoints: boolean): string | null {
  if (figure.shape === 'parallelogram') {
    const [a, b, c, d] = figure.outline.map((label) => pointAt(figure, label));
    if (figure.outline.length !== 4 || !equals(sub(b, a), sub(c, d))) {
      return 'parallelogram has unequal opposite sides';
    }
    if (isParallel(sub(b, a), sub(d, a))) return 'parallelogram is flat';
  } else {
    const [a, b, c] = figure.outline.map((label) => pointAt(figure, label));
    if (figure.outline.length !== 3 || isParallel(sub(b, a), sub(c, a))) {
      return 'triangle is flat';
    }
  }
  for (const { label, of } of figure.midpoints) {
    const [p, q] = of.map((end) => pointAt(figure, end));
    const twice = pointAt(figure, label).map((part) => part.mul(Rational.of(2)));
    if (
      !equals(
        twice,
        p.map((part, i) => part.add(q[i])),
      )
    )
      return `${label} is not a midpoint`;
  }
  if (needsMidpoints && figure.midpoints.length === 0) return 'this level needs a midpoint';
  if (!needsMidpoints && figure.midpoints.length > 0) return 'this level has no midpoints';
  return null;
}

/** Options name distinct vectors, and exactly one of them is the answer. */
function checkOptions(figure: Figure, options: readonly Term[], value: Vec): string | null {
  if (options.length !== 4) return 'a figure item has 4 options';
  const keys = new Set(options.map(figureKey));
  if (keys.size !== options.length) return 'options repeat';
  const values = options.map((option) => termValue(figure, option));
  for (let i = 0; i < values.length; i += 1) {
    for (let j = i + 1; j < values.length; j += 1) {
      if (equals(values[i], values[j])) return 'two options are the same vector';
    }
  }
  if (values.filter((v) => equals(v, value)).length !== 1) return 'no single option is the answer';
  return null;
}

/** What each level of each skill promises (docs/VECTORS.md §2). */
function checkShape(data: VectorData, skill: SkillId, level: Level): string | null {
  const expect = (ok: boolean, message: string) => (ok ? null : message);
  switch (data.form) {
    case 'quantity_kind': {
      if (skill !== 'v_quantity' || level !== 1) return 'quantity_kind is v_quantity L1';
      if (new Set(data.options).size !== 4) return 'quantity_kind has 4 distinct options';
      return expect(quantityMatches(data).length === 1, 'exactly one option is of the asked kind');
    }
    case 'figure_equal': {
      if (skill !== 'v_quantity' || level === 1) return 'figure_equal is v_quantity L2–L3';
      const shape = level === 2 ? 'parallelogram' : 'triangle';
      if (data.figure.shape !== shape) return `v_quantity L${level} uses a ${shape}`;
      if (!data.of.k.equals(Rational.ONE)) return 'the asked vector is a whole named vector';
      return (
        checkFigure(data.figure, level === 3) ??
        checkOptions(data.figure, data.options, askedValue(data))
      );
    }
    case 'figure_expr': {
      if (skill !== 'v_geom') return 'figure_expr is v_geom';
      if (data.figure.shape !== 'parallelogram') return 'v_geom uses a parallelogram';
      const whole = data.expr.every((t) => t.k.abs().equals(Rational.ONE));
      if (level === 1 && !(whole && data.expr.every((t) => t.k.sign() > 0))) {
        return 'v_geom L1 only adds';
      }
      if (level === 2 && !(whole && data.expr.length === 2)) return 'v_geom L2 has two terms';
      if (level === 3 && whole && !data.expr.some((t) => t.to === 'M' || t.from === 'M')) {
        return 'v_geom L3 uses a half or the midpoint';
      }
      return (
        checkFigure(data.figure, level === 3) ??
        checkOptions(data.figure, data.options, exprValue(data.figure, data.expr))
      );
    }
    case 'points': {
      if (skill !== 'v_points' || level === 3) return 'points is v_points L1–L2';
      if (level === 1) {
        if (!allSize(2, data.A, data.B)) return 'v_points L1 is 2D';
        return expect(!hasNegative([...data.A, ...data.B]), 'v_points L1 uses 0–9');
      }
      if (!allSize(3, data.A, data.B)) return 'v_points L2 is 3D';
      return expect(hasNegative([...data.A, ...data.B]), 'v_points L2 has negatives');
    }
    case 'fourth_vertex':
      if (skill !== 'v_points' || level !== 3) return 'fourth_vertex is v_points L3';
      return expect(
        !isParallel(sub(data.B, data.A), sub(data.C, data.B)),
        'A, B, C must not lie on a line',
      );
    case 'linear': {
      if (skill !== 'v_linear') return 'linear is v_linear';
      const vectors = data.terms.map((t) => t.vec);
      if (level === 1) {
        const sum = data.terms.length === 2 && data.terms.every((t) => t.k === 1);
        const scaled = data.terms.length === 1 && data.terms[0].k >= 2;
        if (sum && !allSize(2, ...vectors)) return 'v_linear L1 adds 2D vectors';
        if (!sum && !scaled) return 'v_linear L1 is u + v or ku';
        return expect(!hasNegative(vectors.flat()), 'v_linear L1 has no negatives');
      }
      if (!allSize(3, ...vectors)) return `v_linear L${level} is 3D`;
      if (!hasNegative(vectors.flat())) return `v_linear L${level} has negatives`;
      const signs = data.terms.map((t) => Math.sign(t.k));
      if (level === 2) {
        return expect(
          signs.length === 2 && signs[0] > 0 && signs[1] < 0 && data.notation === 'tuple',
          'v_linear L2 is pu − qv',
        );
      }
      return expect(
        signs.join() === '1,-1,1' && data.notation === 'ijk',
        'v_linear L3 is pu − qv + rw in ijk form',
      );
    }
    case 'parallel': {
      if (skill !== 'v_parallel') return 'parallel is v_parallel';
      const unknowns = [...data.u, ...data.v].filter(isUnknown).length;
      if (!allSize(level === 1 ? 2 : 3, data.u, data.v)) return 'v_parallel has the wrong size';
      return expect(unknowns === (level === 3 ? 2 : 1), `v_parallel L${level} unknown count`);
    }
    case 'magnitude':
      if (skill !== 'v_magnitude' || level === 3) return 'magnitude is v_magnitude L1–L2';
      if (!allSize(level === 1 ? 2 : 3, data.v)) return 'v_magnitude has the wrong size';
      return expect(level === 1 || hasNegative(data.v), 'v_magnitude L2 has negatives');
    case 'magnitude_combo':
    case 'distance':
      return expect(skill === 'v_magnitude' && level === 3, `${data.form} is v_magnitude L3`);
    case 'unit': {
      if (skill !== 'v_unit') return 'unit is v_unit';
      const rational = Surd.sqrt(normSq(data.v)).isRational();
      if (level === 1) return expect(allSize(2, data.v) && rational, 'v_unit L1: 2D, |v| whole');
      if (level === 2) return expect(allSize(3, data.v) && rational, 'v_unit L2: 3D, |v| whole');
      return expect(allSize(3, data.v) && !rational, 'v_unit L3: |v| has a root');
    }
    case 'scaled_unit':
    case 'direction_cosines':
      return expect(
        skill === 'v_unit' && level === 3 && allSize(3, data.v),
        `${data.form} is v_unit L3`,
      );
    case 'dot':
      if (skill !== 'v_dot' || level === 3) return 'dot is v_dot L1–L2';
      if (level === 1) return expect(allSize(2, data.u, data.v), 'v_dot L1 is 2D');
      return expect(
        allSize(3, data.u, data.v) && hasNegative([...data.u, ...data.v]),
        'v_dot L2 is 3D with negatives',
      );
    case 'dot_polar':
      return expect(skill === 'v_dot' && level === 3, 'dot_polar is v_dot L3');
    case 'cos_angle':
      return expect(
        skill === 'v_angle' && level === 1 && allSize(2, data.u, data.v),
        'cos_angle is v_angle L1, 2D',
      );
    case 'angle':
      if (skill !== 'v_angle' || level === 1) return 'angle is v_angle L2–L3';
      if (!allSize(3, data.u, data.v)) return 'v_angle asks θ in 3D';
      return expect(ANGLE_LEVELS[level].includes(data.theta), `θ is not an L${level} angle`);
    case 'perp':
      if (skill !== 'v_perp' || level === 3) return 'perp is v_perp L1–L2';
      return expect(allSize(level === 1 ? 2 : 3, data.u, data.v), 'v_perp has the wrong size');
    case 'perp_property':
      return expect(skill === 'v_perp' && level === 3, 'perp_property is v_perp L3');
    case 'cross': {
      if (skill !== 'v_cross') return 'cross is v_cross';
      const parts = [...data.u, ...data.v];
      if (level === 1 && zeros(parts) < 2) return 'v_cross L1 has at least 2 zeros';
      if (level === 2 && !hasNegative(parts)) return 'v_cross L2 has negatives';
      return expect((data.order === 'vu') === (level === 3), 'only v_cross L3 asks v × u');
    }
    case 'area_parallelogram':
      return expect(skill === 'v_area' && level === 1, 'area_parallelogram is v_area L1');
    case 'area_triangle': {
      if (skill !== 'v_area' || level === 1) return 'area_triangle is v_area L2–L3';
      const flat = [data.A, data.B, data.C].every((p) => p[2].isZero());
      return expect(flat === (level === 3), 'only v_area L3 lies in the xy-plane');
    }
    case 'volume': {
      if (skill !== 'v_volume') return 'volume is v_volume';
      const parts = [...data.u, ...data.v, ...data.w];
      if (level === 1) return expect(zeros(parts) >= 4, 'v_volume L1 has at least 4 zeros');
      return expect(
        triple(data.u, data.v, data.w).sign() < 0,
        'v_volume L2 is negative before the absolute value',
      );
    }
  }
}

function fail(rule: 5 | 6, detail: string): ValidationFailure {
  return { rule, detail };
}

/** Rule 6: checks the answer key against the maths, exactly, as A·A⁻¹ = I does for matrices. */
function checkExact(item: VectorItem): ValidationFailure | null {
  const { data } = item;
  switch (data.form) {
    case 'quantity_kind': {
      const [match] = quantityMatches(data);
      if (QUANTITY_KIND[match] !== data.ask) return fail(6, 'answer is not of the asked kind');
      return null;
    }
    case 'parallel': {
      const i = parallelPair(data.u, data.v);
      if (i === null) return fail(6, 'no given pair fixes k');
      const k = parallelK(data);
      const consistent = data.u.every((part, j) => {
        const other = data.v[j];
        return isUnknown(part) || isUnknown(other) || part.equals(k.mul(other));
      });
      if (!consistent) return fail(6, 'the given parts are not parallel');
      if (partnerOf(data).partner.isZero()) return fail(6, 'the unknown has no unique value');
      const unknownsPerComponent = data.u.every(
        (part, j) => !(isUnknown(part) && isUnknown(data.v[j])),
      );
      return unknownsPerComponent ? null : fail(6, 'two unknowns in one component');
    }
    case 'perp': {
      const at = unknownAt(data.u, data.v, 'k');
      const unknowns = [...data.u, ...data.v].filter(isUnknown).length;
      if (!at || unknowns !== 1) return fail(6, 'a perpendicular item has one unknown k');
      const other = (at.vector === 'u' ? data.v : data.u)[at.index] as Rational;
      if (other.isZero()) return fail(6, 'k has no coefficient, so no unique value');
      if (item.correct.kind !== 'scalar') return fail(6, 'perp answers a number');
      const k = item.correct.value;
      const fill = (parts: Slot[]) => parts.map((part) => (isUnknown(part) ? k : part));
      return dot(fill(data.u), fill(data.v)).isZero()
        ? null
        : fail(6, 'u · v is not 0 at the answer');
    }
    case 'perp_property': {
      const kSquared = perpPropertySquare(data);
      if (kSquared.sign() <= 0) return fail(6, 'k² must be positive');
      const k = item.correct.kind === 'scalar' ? item.correct.value : null;
      if (!k || k.sign() <= 0 || !k.mul(k).equals(kSquared)) return fail(6, 'k² is wrong');
      const v = data.v.map((part) => (isUnknown(part) ? k : part));
      if (isParallel(data.u, v)) return fail(6, 'u and v are parallel');
      return normSq(data.u).equals(normSq(v)) ? null : fail(6, '|u| ≠ |v| at the answer');
    }
    case 'angle': {
      if (!isStandardAngle(data.theta)) return fail(6, 'θ is not a standard angle');
      if (!cosAngle(data.u, data.v).equals(cosOf(data.theta))) {
        return fail(6, 'cos θ of u, v does not match θ');
      }
      return angleOf(data.u, data.v) === data.theta ? null : fail(6, 'θ is wrong');
    }
    case 'dot_polar':
      return isStandardAngle(data.theta) ? null : fail(6, 'θ is not a standard angle');
    case 'cross': {
      const [first, second] = crossFactors(data);
      if (item.correct.kind !== 'vector') return fail(6, 'cross answers a vector');
      const answer = item.correct.value.map((part) => part.toRational());
      if (isZeroVec(answer)) return fail(6, 'the vectors are parallel');
      if (!dot(answer, first).isZero() || !dot(answer, second).isZero()) {
        return fail(6, 'the cross product is not perpendicular to both');
      }
      return null;
    }
    case 'area_parallelogram':
      return isParallel(data.u, data.v) ? fail(6, 'the area is 0') : null;
    case 'volume':
      return triple(data.u, data.v, data.w).isZero() ? fail(6, 'the volume is 0') : null;
    case 'unit':
    case 'scaled_unit':
    case 'direction_cosines':
    case 'magnitude':
      return isZeroVec(data.v) ? fail(6, 'the zero vector') : null;
    case 'dot':
    case 'cos_angle':
      return isZeroVec(data.u) || isZeroVec(data.v) ? fail(6, 'the zero vector') : null;
    default:
      return null;
  }
}

/** V20 may differ in one component only: the middle one, by exact negation, with |c₂| ≥ 2. */
function checkOneOff(item: VectorItem): ValidationFailure | null {
  for (const diagnostic of item.diagnostics) {
    if (!diagnostic.oneOff) continue;
    const { answer } = diagnostic;
    if (diagnostic.id !== 'V20_CROSS_MIDDLE_SIGN') {
      return fail(6, `${diagnostic.id} may not be one component away`);
    }
    if (answer.kind !== 'vector' || item.correct.kind !== 'vector') {
      return fail(6, 'V20 compares vectors');
    }
    const correct = item.correct.value;
    if (correct.length !== 3 || countDiffComponents(answer.value, correct) !== 1) {
      return fail(6, 'V20 differs in exactly one component');
    }
    if (!answer.value[1].equals(correct[1].neg())) return fail(6, 'V20 negates the middle one');
    if (correct[1].abs().compare(Surd.rational(2)) < 0) return fail(6, 'V20 needs |c₂| ≥ 2');
  }
  return null;
}

/** docs/VECTORS.md §3.4: rules 5 and 6 of the vector topic. */
export function vectorRules(item: Item): ValidationFailure | null {
  const vectorItem = item as VectorItem;
  const { data, ref } = vectorItem;
  const shape = checkShape(data, ref.skill, ref.difficulty);
  if (shape) return fail(5, shape);
  const limits = limitProblem(data);
  if (limits) return fail(5, limits);
  return checkExact(vectorItem) ?? checkOneOff(vectorItem);
}

export function validateVectorItem(item: VectorItem): ValidationResult {
  return validateItem(item, vectorRules);
}
