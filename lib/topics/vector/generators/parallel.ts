import { Rational } from '@/lib/core/rational';
import type { Rng } from '@/lib/core/prng';
import { solve } from '../solve';
import type { Level } from '@/lib/core/types';
import type { ItemBody, SkillGenerator, Slot, VectorData } from '../types';
import { nonZero, wrongForm } from './sample';

/** u = kv with k ≠ ±1, so flipping the ratio (V08) gives a different number. */
const RATIOS: [number, number][] = [
  [2, 1],
  [3, 1],
  [-2, 1],
  [-3, 1],
  [1, 2],
  [-1, 2],
  [3, 2],
  [-3, 2],
  [2, 3],
  [-2, 3],
];

/**
 * v = d·t and u = n·t for k = n/d, so every given part is whole. One unknown at L1–L2 sits in u; at L3
 * a second one sits in v, in another component, and the item asks for one of the two.
 */
function sampleParallel(rng: Rng, level: Level): VectorData {
  const [n, d] = rng.pick(RATIOS);
  const size = level === 1 ? 2 : 3;
  const reach = Math.floor(9 / Math.max(Math.abs(n), d));
  const t = Array.from({ length: size }, () => rng.pick(nonZero(reach)));
  const u: Slot[] = t.map((part) => Rational.of(n * part));
  const v: Slot[] = t.map((part) => Rational.of(d * part));
  const [m, second] = rng.sample(
    Array.from({ length: size }, (_, i) => i),
    level === 3 ? 2 : 1,
  );
  u[m] = 'm';
  if (level === 3) v[second] = 'n';
  return { form: 'parallel', u, v, ask: level === 3 && rng.chance(1, 2) ? 'n' : 'm' };
}

export const parallel: SkillGenerator = {
  sample(rng, level) {
    return sampleParallel(rng, level);
  },

  body(data): ItemBody {
    if (data.form !== 'parallel') throw wrongForm('v_parallel', data.form);
    return {
      kind: 'scalar',
      prompt: { key: 'parallel_find', params: { x: data.ask } },
      data,
      correct: solve(data),
    };
  },
};
