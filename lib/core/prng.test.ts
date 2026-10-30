import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { createRng, deriveSeed } from './prng';

const seedArb = fc.integer({ min: 0, max: 0xffffffff });

describe('createRng', () => {
  // Reference values from the standard mulberry32. Changing them invalidates every stored ItemRef.
  it.each([
    [0, [1144304738, 1416247, 958946056]],
    [1, [2693262067, 11749833, 2265367787]],
    [42, [2581720956, 1925393290, 3661312704]],
  ])('seed %i produces the mulberry32 sequence', (seed, expected) => {
    const rng = createRng(seed);
    expect([rng.next(), rng.next(), rng.next()]).toEqual(expected);
  });

  it('is deterministic', () => {
    fc.assert(
      fc.property(seedArb, (seed) => {
        const a = createRng(seed);
        const b = createRng(seed);
        for (let i = 0; i < 8; i += 1) expect(a.next()).toBe(b.next());
      }),
    );
  });

  it('gives neighbouring seeds unrelated streams, so resampling with seed+1 is a new draw', () => {
    const firsts = new Set<number>();
    for (let seed = 0; seed < 1000; seed += 1) firsts.add(createRng(seed).next() % 1000);
    expect(firsts.size).toBeGreaterThan(550);
  });

  it('treats any seed as uint32', () => {
    expect(createRng(-1).next()).toBe(createRng(0xffffffff).next());
    expect(createRng(2 ** 32).next()).toBe(createRng(0).next());
  });
});

describe('rng.int', () => {
  it('stays within inclusive bounds', () => {
    fc.assert(
      fc.property(
        seedArb,
        fc.integer({ min: -50, max: 50 }),
        fc.integer({ min: 0, max: 50 }),
        (seed, min, span) => {
          const value = createRng(seed).int(min, min + span);
          expect(Number.isInteger(value)).toBe(true);
          expect(value).toBeGreaterThanOrEqual(min);
          expect(value).toBeLessThanOrEqual(min + span);
        },
      ),
    );
  });

  it('reaches every value of a small range', () => {
    const rng = createRng(1);
    const seen = new Set<number>();
    for (let i = 0; i < 500; i += 1) seen.add(rng.int(-3, 3));
    expect([...seen].sort((a, b) => a - b)).toEqual([-3, -2, -1, 0, 1, 2, 3]);
  });

  it('rejects an empty range', () => {
    expect(() => createRng(1).int(3, 2)).toThrow(RangeError);
  });
});

describe('rng.pick, shuffle, sample, chance', () => {
  it('pick returns a member', () => {
    fc.assert(
      fc.property(seedArb, (seed) => {
        expect(['a', 'b', 'c']).toContain(createRng(seed).pick(['a', 'b', 'c']));
      }),
    );
  });

  it('pick rejects an empty list', () => {
    expect(() => createRng(1).pick([])).toThrow(RangeError);
  });

  it('shuffle is a permutation and leaves its input alone', () => {
    fc.assert(
      fc.property(seedArb, (seed) => {
        const input = [1, 2, 3, 4, 5, 6];
        const shuffled = createRng(seed).shuffle(input);
        expect([...shuffled].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6]);
        expect(input).toEqual([1, 2, 3, 4, 5, 6]);
      }),
    );
  });

  it('sample returns distinct members', () => {
    fc.assert(
      fc.property(seedArb, fc.integer({ min: 0, max: 9 }), (seed, count) => {
        const pool = [1, 2, 3, 4, 5, 6, 7, 8, 9];
        const chosen = createRng(seed).sample(pool, count);
        expect(chosen).toHaveLength(count);
        expect(new Set(chosen).size).toBe(count);
        for (const value of chosen) expect(pool).toContain(value);
      }),
    );
  });

  it('sample rejects a count larger than the pool', () => {
    expect(() => createRng(1).sample([1, 2], 3)).toThrow(RangeError);
  });

  it('chance respects its extremes and is roughly fair', () => {
    const rng = createRng(1);
    let hits = 0;
    for (let i = 0; i < 1000; i += 1) {
      expect(rng.chance(0, 4)).toBe(false);
      expect(rng.chance(4, 4)).toBe(true);
      if (rng.chance(1, 4)) hits += 1;
    }
    expect(hits).toBeGreaterThan(180);
    expect(hits).toBeLessThan(320);
  });
});

describe('deriveSeed', () => {
  it('is pure', () => {
    fc.assert(
      fc.property(fc.string(), fc.nat(), (student, counter) => {
        expect(deriveSeed(student, counter)).toBe(deriveSeed(student, counter));
      }),
    );
  });

  it('returns a uint32', () => {
    fc.assert(
      fc.property(fc.string(), fc.nat(), (student, counter) => {
        const seed = deriveSeed(student, counter);
        expect(Number.isInteger(seed)).toBe(true);
        expect(seed).toBeGreaterThanOrEqual(0);
        expect(seed).toBeLessThanOrEqual(0xffffffff);
      }),
    );
  });

  it('gives different students different seeds for the same counter', () => {
    const seeds = new Set<number>();
    for (let seat = 1; seat <= 40; seat += 1) seeds.add(deriveSeed(`student-${seat}`, 0));
    expect(seeds.size).toBe(40);
  });

  it('gives one student a new seed for every counter', () => {
    const seeds = new Set<number>();
    for (let counter = 0; counter < 1000; counter += 1) seeds.add(deriveSeed('student-1', counter));
    expect(seeds.size).toBe(1000);
  });

  it('does not confuse the student id and counter boundary', () => {
    expect(deriveSeed('a1', 2)).not.toBe(deriveSeed('a', 12));
  });

  // Frozen: changing the hash would change the numbers every student already saw.
  it('stays frozen', () => {
    expect(deriveSeed('00000000-0000-4000-8000-000000000000', 0)).toBe(376498144);
  });
});
