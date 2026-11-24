import type { Rng } from '@/lib/core/prng';
import { linearExprText } from '../format';
import { add, isParallel, norm, sub, vec } from '../ops';
import { linearVec, solve } from '../solve';
import type { ItemBody, LinearTerm, SkillGenerator, Vec, VectorData } from '../types';
import {
  allVectors,
  drawUntil,
  drawVec,
  lazy,
  negative,
  nonZero,
  range,
  wrongForm,
  zeroCount,
} from './sample';

/** Small 3D vectors grouped by the radicand of their length, so |u| + |v| is one Surd (V11). */
const BY_RADICAND = lazy(() => {
  const groups = new Map<number, Vec[]>();
  for (const parts of allVectors(3, -3, 3)) {
    const v = vec(...parts);
    const { radicand } = norm(v);
    const group = groups.get(radicand) ?? [];
    group.push(v);
    groups.set(radicand, group);
  }
  return [...groups.values()].filter((group) => group.length >= 2);
});

const SMALL = range(-3, 3);

function combo(rng: Rng, sameRadicand: boolean): VectorData {
  return drawUntil(
    () => {
      const [p, q] = rng.pick([
        [1, 1],
        [1, 1],
        [1, 2],
        [2, 1],
      ]);
      const [u, v] = sameRadicand
        ? rng.sample(rng.pick(BY_RADICAND()), 2)
        : [drawVec(rng, 3, SMALL), drawVec(rng, 3, SMALL)];
      const terms: LinearTerm[] = [
        { k: p, name: 'u', vec: u },
        { k: q, name: 'v', vec: v },
      ];
      return { form: 'magnitude_combo', terms } as const;
    },
    ({ terms }) => {
      const [u, v] = terms.map((t) => t.vec);
      const w = linearVec(terms);
      return zeroCount(u) < 3 && zeroCount(v) < 3 && !isParallel(u, v) && zeroCount(w) <= 1;
    },
  );
}

function distance(rng: Rng): VectorData {
  return drawUntil(
    () => {
      const A = drawVec(rng, 3, range(-6, 6));
      return { form: 'distance', A, B: add(A, drawVec(rng, 3, range(-7, 7))) } as const;
    },
    ({ A, B }) => B.every((part) => Math.abs(part.n) <= 9) && zeroCount(sub(B, A)) <= 1,
  );
}

export const magnitude: SkillGenerator = {
  sample(rng, level, { target }) {
    if (level === 1) return { form: 'magnitude', v: drawVec(rng, 2, nonZero(7)) };
    if (level === 2) {
      return drawUntil(
        () => ({ form: 'magnitude', v: drawVec(rng, 3, range(-7, 7)) }) as const,
        ({ v }) => negative(v) && zeroCount(v) <= 1,
      );
    }
    if (target === 'V11_MAG_ADDITIVE') return combo(rng, true);
    return rng.chance(1, 2) ? combo(rng, rng.chance(1, 2)) : distance(rng);
  },

  body(data): ItemBody {
    switch (data.form) {
      case 'magnitude':
        return { kind: 'surd', prompt: { key: 'magnitude_find' }, data, correct: solve(data) };
      case 'magnitude_combo':
        return {
          kind: 'surd',
          prompt: { key: 'magnitude_combo', params: { expr: linearExprText(data.terms) } },
          data,
          correct: solve(data),
        };
      case 'distance':
        return { kind: 'surd', prompt: { key: 'distance_find' }, data, correct: solve(data) };
      default:
        throw wrongForm('v_magnitude', data.form);
    }
  },
};
