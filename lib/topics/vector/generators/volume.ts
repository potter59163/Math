import type { Rng } from '@/lib/core/prng';
import { triple, vec } from '../ops';
import { solve } from '../solve';
import type { ItemBody, Probe, SkillGenerator, VectorData } from '../types';
import { drawUntil, drawVec, range, wrongForm } from './sample';

/** Swaps v and w when that makes u·(v × w) negative, so the absolute value matters (V25). */
function negativeOrder(data: Extract<VectorData, { form: 'volume' }>): VectorData {
  return triple(data.u, data.v, data.w).sign() > 0 ? { ...data, v: data.w, w: data.v } : data;
}

/** L1: at least four zeros among the nine components. */
function sparse(rng: Rng, { target }: Probe): VectorData {
  const data = drawUntil(
    () => {
      const parts = Array.from({ length: 9 }, () => rng.int(1, 4));
      for (const index of rng.sample(range(0, 8), rng.int(4, 5))) parts[index] = 0;
      return {
        form: 'volume',
        u: vec(...parts.slice(0, 3)),
        v: vec(...parts.slice(3, 6)),
        w: vec(...parts.slice(6)),
      } as const;
    },
    ({ u, v, w }) => !triple(u, v, w).isZero(),
  );
  return target === 'V25_VOLUME_SIGNED' || rng.chance(1, 2) ? negativeOrder(data) : data;
}

/** L2: general, and always negative before the absolute value. */
function general(rng: Rng): VectorData {
  const pool = range(-3, 3);
  const data = drawUntil(
    () =>
      ({
        form: 'volume',
        u: drawVec(rng, 3, pool),
        v: drawVec(rng, 3, pool),
        w: drawVec(rng, 3, pool),
      }) as const,
    ({ u, v, w }) => !triple(u, v, w).isZero(),
  );
  return negativeOrder(data);
}

export const volume: SkillGenerator = {
  sample(rng, level, probe) {
    return level === 1 ? sparse(rng, probe) : general(rng);
  },

  body(data): ItemBody {
    if (data.form !== 'volume') throw wrongForm('v_volume', data.form);
    return { kind: 'surd', prompt: { key: 'volume_find' }, data, correct: solve(data) };
  },
};
