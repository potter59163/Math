import { Rational } from '@/lib/core/rational';
import type { Rng } from '@/lib/core/prng';
import type { Level } from '@/lib/core/types';
import { isParallel, normSq, vec } from '../ops';
import { perpAnswer, solve } from '../solve';
import type { ItemBody, SkillGenerator, Slot, Vec, VectorData } from '../types';
import { allVectors, drawUntil, lazy, nonZero, range, wrongForm } from './sample';

/** u ⊥ v with k in u; k comes out whole, non-zero and within 9. */
function perpendicular(rng: Rng, level: Level): VectorData {
  const size = level === 1 ? 2 : 3;
  return drawUntil(
    () => {
      const j = rng.int(0, size - 1);
      const u: Slot[] = Array.from({ length: size }, () => Rational.of(rng.pick(nonZero(6))));
      // At L1 every part of v is non-zero, so k always meets a ratio V19 can set up.
      const pool = level === 1 ? nonZero(6) : range(-6, 6);
      const v: Slot[] = Array.from({ length: size }, () => Rational.of(rng.pick(pool)));
      u[j] = 'k';
      v[j] = Rational.of(rng.pick(nonZero(3)));
      return { form: 'perp', u, v } as const;
    },
    (data) => {
      const k = perpAnswer(data);
      return k.isInteger() && !k.isZero() && k.abs().compare(Rational.of(9)) <= 0;
    },
  );
}

/** Vectors with components in −7..7 grouped by |v|², for (u + v) ⊥ (u − v), that is |u| = |v|. */
const BY_LENGTH = lazy(() => {
  const groups = new Map<string, Vec[]>();
  for (const parts of allVectors(3, -7, 7)) {
    const v = vec(...parts);
    const key = normSq(v).toString();
    const group = groups.get(key) ?? [];
    group.push(v);
    groups.set(key, group);
  }
  return [...groups.values()].filter((group) => group.length >= 2);
});

function property(rng: Rng): VectorData {
  return drawUntil(
    () => {
      const [u, full] = rng.sample(rng.pick(BY_LENGTH()), 2);
      const j = rng.int(0, 2);
      const v: Slot[] = [...full];
      v[j] = 'k';
      return { data: { form: 'perp_property', u, v } as const, full, j };
    },
    ({ data, full, j }) => !full[j].isZero() && !isParallel(data.u, full),
  ).data;
}

export const perp: SkillGenerator = {
  sample(rng, level) {
    return level === 3 ? property(rng) : perpendicular(rng, level);
  },

  body(data): ItemBody {
    switch (data.form) {
      case 'perp':
        return { kind: 'scalar', prompt: { key: 'perp_find' }, data, correct: solve(data) };
      case 'perp_property':
        return { kind: 'scalar', prompt: { key: 'perp_property' }, data, correct: solve(data) };
      default:
        throw wrongForm('v_perp', data.form);
    }
  },
};
