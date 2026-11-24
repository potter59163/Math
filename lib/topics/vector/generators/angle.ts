import { isParallel, dot, vec } from '../ops';
import { ANGLE_LEVELS, limitProblem } from '../rules';
import { solve } from '../solve';
import type { Angle, ItemBody, SkillGenerator, Vec } from '../types';
import { allVectors, lazy, wrongForm } from './sample';

/**
 * Integer pairs by the standard angle between them, found exactly: 4(u·v)² is 0, 1, 2, 3 or 4 times
 * |u|²|v|², with the sign of u·v. Integers only, so nothing is ever rounded.
 */
const PAIRS_BY_ANGLE = lazy(() => {
  const vectors = allVectors(3, -3, 3);
  const byAngle = new Map<Angle, [number[], number[]][]>();
  const QUARTERS: Record<number, [Angle, Angle]> = {
    0: [90, 90],
    1: [60, 120],
    2: [45, 135],
    3: [30, 150],
    4: [0, 180],
  };
  for (const u of vectors) {
    const uu = u[0] * u[0] + u[1] * u[1] + u[2] * u[2];
    for (const v of vectors) {
      const vv = v[0] * v[0] + v[1] * v[1] + v[2] * v[2];
      const d = u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
      const scaled = 4 * d * d;
      if (scaled % (uu * vv) !== 0) continue;
      const quarter = scaled / (uu * vv);
      const angles = QUARTERS[quarter];
      if (!angles) continue;
      const theta = d >= 0 ? angles[0] : angles[1];
      const list = byAngle.get(theta) ?? [];
      list.push([u, v]);
      byAngle.set(theta, list);
    }
  }
  return byAngle;
});

/** Pairs for one angle with every component within `limit`. */
function pairsFor(theta: Angle, limit: number): [Vec, Vec][] {
  return (PAIRS_BY_ANGLE().get(theta) ?? [])
    .filter(([u, v]) => [...u, ...v].every((part) => Math.abs(part) <= limit))
    .map(([u, v]) => [vec(...u), vec(...v)]);
}

const CACHE = new Map<string, [Vec, Vec][]>();
function cachedPairs(theta: Angle, limit: number): [Vec, Vec][] {
  const key = `${theta}:${limit}`;
  if (!CACHE.has(key)) CACHE.set(key, pairsFor(theta, limit));
  return CACHE.get(key)!;
}

/** 2D pairs whose cos θ fits the limits, standard angle or not. L1 only asks for cos θ. */
const PLANE_PAIRS = lazy(() => {
  const vectors = allVectors(2, -5, 5).map((parts) => vec(...parts));
  const pairs: [Vec, Vec][] = [];
  for (const u of vectors) {
    for (const v of vectors) {
      if (isParallel(u, v) || dot(u, v).isZero()) continue;
      if (limitProblem({ form: 'cos_angle', u, v }) === null) pairs.push([u, v]);
    }
  }
  return pairs;
});

export const angle: SkillGenerator = {
  sample(rng, level, { target }) {
    if (level === 1) {
      const [u, v] = rng.pick(PLANE_PAIRS());
      return { form: 'cos_angle', u, v };
    }
    // The angle comes first; the vectors are then drawn to fit it.
    const angles = (
      level === 2 && target === 'V17_ANGLE_ABS' ? [120, 135] : ANGLE_LEVELS[level]
    ) as Angle[];
    const theta = rng.pick(angles);
    const [u, v] = rng.pick(cachedPairs(theta, level === 2 ? 2 : 3));
    return { form: 'angle', u, v, theta };
  },

  body(data): ItemBody {
    switch (data.form) {
      case 'cos_angle':
        return { kind: 'surd', prompt: { key: 'cos_find' }, data, correct: solve(data) };
      case 'angle':
        return { kind: 'scalar', prompt: { key: 'angle_find' }, data, correct: solve(data) };
      default:
        throw wrongForm('v_angle', data.form);
    }
  },
};
