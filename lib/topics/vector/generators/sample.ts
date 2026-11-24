import { Rational } from '@/lib/core/rational';
import type { Rng } from '@/lib/core/prng';
import { figureKey } from '../format';
import { equals, vec } from '../ops';
import { termValue } from '../solve';
import type { Figure, FigurePoint, PointLabel, Term, Vec } from '../types';

export function range(min: number, max: number): number[] {
  return Array.from({ length: max - min + 1 }, (_, i) => min + i);
}

/** −n..−1 and 1..n: every magnitude up to n, with no zero. */
export function nonZero(n: number): number[] {
  return [...range(-n, -1), ...range(1, n)];
}

/** A vector whose components are drawn independently from `pool`. */
export function drawVec(rng: Rng, size: 2 | 3, pool: readonly number[]): Vec {
  return vec(...Array.from({ length: size }, () => rng.pick(pool)));
}

/** Draws until `ok`, at most `tries` times; the last draw is returned either way. */
export function drawUntil<T>(draw: () => T, ok: (value: T) => boolean, tries = 200): T {
  let value = draw();
  for (let i = 1; i < tries && !ok(value); i += 1) value = draw();
  return value;
}

/** Builds a value once, on first use, so a pool is only paid for by the skills that need it. */
export function lazy<T>(build: () => T): () => T {
  let value: T | undefined;
  return () => {
    value ??= build();
    return value;
  };
}

/** Every integer vector of this size with components in min..max, except zero. */
export function allVectors(size: 2 | 3, min: number, max: number): number[][] {
  const parts = range(min, max);
  const result: number[][] = size === 2 ? parts.flatMap((a) => parts.map((b) => [a, b])) : [];
  if (size === 3) {
    for (const a of parts) for (const b of parts) for (const c of parts) result.push([a, b, c]);
  }
  return result.filter((v) => v.some((part) => part !== 0));
}

export const negative = (v: readonly Rational[]): boolean => v.some((part) => part.sign() < 0);
export const zeroCount = (v: readonly Rational[]): number => v.filter((p) => p.isZero()).length;

export function wrongForm(skill: string, form: string): Error {
  return new Error(`${skill}: unexpected item form ${form}`);
}

export const ONE = Rational.ONE;
export const HALF = Rational.of(1, 2);
export const TWO = Rational.of(2);

export const term = (k: Rational, from: PointLabel, to: PointLabel): Term => ({ k, from, to });
export const whole = (from: PointLabel, to: PointLabel): Term => term(ONE, from, to);
export const reversed = (t: Term): Term => term(t.k, t.to, t.from);

const PARALLELOGRAM: PointLabel[] = ['A', 'B', 'C', 'D'];

/** The vertex `steps` places along the outline from `index`, in either direction. */
export function vertex(index: number, steps = 0): PointLabel {
  return PARALLELOGRAM[(((index + steps) % 4) + 4) % 4];
}

/**
 * A slanted parallelogram ABCD with hidden integer coordinates. With a midpoint, the sides are even,
 * so the midpoint M of `midpointOf` has integer coordinates too.
 */
export function parallelogram(rng: Rng, midpointOf?: [PointLabel, PointLabel]): Figure {
  const even = midpointOf !== undefined;
  const u = even ? [rng.pick([4, 6, 8]), 0] : [rng.int(4, 7), rng.int(0, 1)];
  const v = even ? [rng.pick([0, 2]), rng.pick([4, 6])] : [rng.int(1, 3), rng.int(3, 5)];
  const a: [number, number] = [rng.int(0, 2), rng.int(0, 2)];
  const at = (du: number, dv: number): [number, number] => [
    a[0] + du * u[0] + dv * v[0],
    a[1] + du * u[1] + dv * v[1],
  ];
  const points: FigurePoint[] = [
    { label: 'A', at: at(0, 0) },
    { label: 'B', at: at(1, 0) },
    { label: 'C', at: at(1, 1) },
    { label: 'D', at: at(0, 1) },
  ];
  if (!midpointOf) return { shape: 'parallelogram', outline: PARALLELOGRAM, points, midpoints: [] };
  const [p, q] = midpointOf.map((label) => points.find((point) => point.label === label)!.at);
  points.push({ label: 'M', at: [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2] });
  return {
    shape: 'parallelogram',
    outline: PARALLELOGRAM,
    points,
    midpoints: [{ label: 'M', of: midpointOf }],
  };
}

/**
 * Triangle ABC whose apex P is one of A, B, C, with M the midpoint of PQ and N the midpoint of PR.
 * Even coordinates keep the midpoints whole.
 */
export function triangleWithMidpoints(rng: Rng): {
  figure: Figure;
  apex: PointLabel;
  left: PointLabel;
  right: PointLabel;
} {
  const [apex, left, right] = rng.shuffle<PointLabel>(['A', 'B', 'C']);
  const base = rng.int(3, 5);
  const top: [number, number] = [2 * rng.int(0, base), 2 * rng.int(2, 4)];
  const coords: Record<string, [number, number]> = {
    [apex]: top,
    [left]: [0, 0],
    [right]: [2 * base, 0],
  };
  const mid = (p: [number, number], q: [number, number]): [number, number] => [
    (p[0] + q[0]) / 2,
    (p[1] + q[1]) / 2,
  ];
  const points: FigurePoint[] = [
    ...(['A', 'B', 'C'] as const).map((label) => ({ label, at: coords[label] })),
    { label: 'M', at: mid(coords[apex], coords[left]) },
    { label: 'N', at: mid(coords[apex], coords[right]) },
  ];
  return {
    figure: {
      shape: 'triangle',
      outline: ['A', 'B', 'C'],
      points,
      midpoints: [
        { label: 'M', of: [apex, left] },
        { label: 'N', of: [apex, right] },
      ],
    },
    apex,
    left,
    right,
  };
}

/** Every option a figure can offer: each ordered pair of its points, at the given scales. */
export function figureTerms(figure: Figure, scales: readonly Rational[] = [ONE]): Term[] {
  const labels = figure.points.map((point) => point.label);
  return scales.flatMap((k) =>
    labels.flatMap((from) => labels.filter((to) => to !== from).map((to) => term(k, from, to))),
  );
}

/**
 * Four options: the answer, a lure the item is built to catch, and two decoys that name other
 * vectors. No two options are the same vector, so exactly one is right.
 */
export function figureOptions(
  rng: Rng,
  figure: Figure,
  answer: Term,
  lure: Term,
  pool: readonly Term[],
  preferred: readonly Term[] = [],
): Term[] {
  const chosen = [answer, lure];
  const values = chosen.map((t) => termValue(figure, t));
  const taken = (t: Term) =>
    chosen.some((c) => figureKey(c) === figureKey(t)) ||
    values.some((value) => equals(value, termValue(figure, t)));
  for (const candidate of [...rng.shuffle(preferred), ...rng.shuffle(pool)]) {
    if (chosen.length === 4) break;
    if (taken(candidate)) continue;
    chosen.push(candidate);
    values.push(termValue(figure, candidate));
  }
  return rng.shuffle(chosen);
}
