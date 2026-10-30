export interface Rng {
  /** Next uint32 of the stream. */
  next(): number;
  /** Integer in [min, max], inclusive. */
  int(min: number, max: number): number;
  pick<T>(items: readonly T[]): T;
  /** Shuffled copy of `items`. */
  shuffle<T>(items: readonly T[]): T[];
  /** `count` distinct positions of `items`, in random order. */
  sample<T>(items: readonly T[], count: number): T[];
  /** True with probability numerator / denominator. */
  chance(numerator: number, denominator: number): boolean;
}

/** Seeded mulberry32. The only source of randomness allowed in the engine. */
export function createRng(seed: number): Rng {
  let state = seed | 0;

  const next = (): number => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return (t ^ (t >>> 14)) >>> 0;
  };

  const int = (min: number, max: number): number => {
    if (max < min) throw new RangeError(`Rng: empty range [${min}, ${max}]`);
    return min + (next() % (max - min + 1));
  };

  const shuffle = <T>(items: readonly T[]): T[] => {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i -= 1) {
      const j = int(0, i);
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  };

  return {
    next,
    int,
    shuffle,
    pick: <T>(items: readonly T[]): T => {
      if (items.length === 0) throw new RangeError('Rng: cannot pick from an empty list');
      return items[int(0, items.length - 1)];
    },
    sample: <T>(items: readonly T[], count: number): T[] => {
      if (count > items.length) {
        throw new RangeError(`Rng: cannot sample ${count} from ${items.length} items`);
      }
      return shuffle(items).slice(0, count);
    },
    chance: (numerator: number, denominator: number): boolean => next() % denominator < numerator,
  };
}

/**
 * Item seed for one student's nth item (SPEC §6): a pure hash, so students get their own numbers
 * and any item can be rebuilt from its ItemRef. FNV-1a, then the murmur3 finalizer to spread the bits.
 */
export function deriveSeed(studentId: string, counter: number): number {
  const key = `${studentId}:${counter}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < key.length; i += 1) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85ebca6b);
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2b2ae35);
  hash ^= hash >>> 16;
  return hash >>> 0;
}
