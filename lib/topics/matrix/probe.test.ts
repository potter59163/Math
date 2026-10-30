import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { classify } from '@/lib/core/classify';
import { createRng } from '@/lib/core/prng';
import { Rational } from '@/lib/core/rational';
import type { Answer, Level } from '@/lib/core/types';
import { generate } from './generators';
import { CATALOG, probeLevel, probeLevels, variantsOf } from './misconceptions';
import { validateMatrixItem } from './rules';
import type { SkillId } from './skills';
import type { MatrixItem, MisconceptionId } from './types';

// Typed by hand from docs/MISCONCEPTIONS.md §4.1 so the implementation has something to disagree with.
const TABLE_4_1: { id: MisconceptionId; skill: SkillId; levels: Level[] }[] = [
  { id: 'M01_DIM_SWAP', skill: 'dim', levels: [1, 2, 3] },
  { id: 'M02_INDEX_SWAP', skill: 'index', levels: [1, 2, 3] },
  { id: 'M03_TRANSPOSE_WRONG', skill: 'transpose', levels: [1, 2, 3] },
  { id: 'M04_ADD_DIM_MISMATCH', skill: 'addsub', levels: [2, 3] },
  { id: 'M05_SUB_REVERSED', skill: 'addsub', levels: [2, 3] },
  { id: 'M07_SCALAR_PARTIAL', skill: 'scalar', levels: [1, 2] },
  { id: 'M08_MULT_DIM_RULE', skill: 'mult_defined', levels: [1, 2] },
  { id: 'M09_MULT_ELEMENTWISE', skill: 'mult', levels: [1, 2] },
  { id: 'M10_MULT_ROW_ROW', skill: 'mult', levels: [1, 2, 3] },
  { id: 'M11_MULT_COMMUTATIVE', skill: 'mult', levels: [1, 2] },
  { id: 'M11_MULT_COMMUTATIVE', skill: 'mult_noncomm', levels: [1, 2, 3] },
  { id: 'M12_DET2_FORMULA', skill: 'det2', levels: [1, 2] },
  { id: 'M13_DET3_SIGN', skill: 'det3', levels: [1, 2, 3] },
  { id: 'M14_DET_SCALAR_LINEAR', skill: 'det_props', levels: [1, 2] },
  { id: 'M15_DET_ADDITIVE', skill: 'det_props', levels: [2] },
  { id: 'M18_INV_SINGULAR', skill: 'invertible', levels: [1, 2, 3] },
  { id: 'M19_INV_ZERO_ENTRY', skill: 'invertible', levels: [2, 3] },
  { id: 'M20_INV2_RECIPE', skill: 'inv2', levels: [1, 2, 3] },
  { id: 'M21_INV_RECIPROCAL', skill: 'inv2', levels: [1, 2, 3] },
];

// Variants that §3 and §4.1 limit to some of their misconception's levels.
const VARIANT_LEVELS: Partial<Record<MisconceptionId, Record<string, Level[]>>> = {
  M03_TRANSPOSE_WRONG: { FLIP_H: [1, 3], FLIP_V: [1, 3], SAME: [1, 3] },
  M20_INV2_RECIPE: { NO_DIVIDE: [2, 3], TIMES_DET: [2, 3] },
};

const seedArb = fc.integer({ min: 0, max: 0xffffffff });

function expectProbe(item: MatrixItem, id: MisconceptionId, variant?: string) {
  expect(validateMatrixItem(item)).toEqual({ ok: true });
  expect(item.ref.target).toBe(id);
  expect(item.diagnostics[0].id).toBe(id);
  if (variant !== undefined) expect(item.diagnostics[0].variant).toBe(variant);
  for (const diagnostic of item.diagnostics) {
    const answer: Answer =
      diagnostic.answer.kind === 'any_matrix' ? randomMatrixForGrid(item) : diagnostic.answer;
    const expected = { type: 'misconception', id: diagnostic.id, variant: diagnostic.variant };
    expect(classify(item, answer)).toEqual(expected);
  }
}

/** M04 matches whatever matrix the student enters, so it is tested with a random one (§3). */
function randomMatrixForGrid(item: MatrixItem): Answer {
  const rng = createRng(item.ref.seed);
  const value = Array.from({ length: item.grid!.rows }, () =>
    Array.from({ length: item.grid!.cols }, () => Rational.of(rng.int(-9, 9))),
  );
  return { kind: 'matrix', value };
}

describe('probeLevel examples from §4.1', () => {
  it.each<[SkillId, MisconceptionId, Level, Level]>([
    ['addsub', 'M05_SUB_REVERSED', 1, 2],
    ['mult', 'M09_MULT_ELEMENTWISE', 3, 2],
    ['det_props', 'M15_DET_ADDITIVE', 1, 2],
    ['invertible', 'M19_INV_ZERO_ENTRY', 1, 2],
    ['mult', 'M09_MULT_ELEMENTWISE', 1, 1],
    ['mult', 'M10_MULT_ROW_ROW', 3, 3],
  ])('probeLevel(%s, %s, %i) = %i', (skill, id, level, expected) => {
    expect(probeLevel(skill, id, level)).toBe(expected);
  });
});

describe('probeLevels', () => {
  it.each(TABLE_4_1)('$id on $skill is $levels', ({ id, skill, levels }) => {
    expect(probeLevels(skill, id)).toEqual(levels);
  });

  it('has no row the table does not list', () => {
    const rows = CATALOG.flatMap((entry) => entry.probes.map((p) => `${entry.id}/${p.skill}`));
    expect(rows.sort()).toEqual(TABLE_4_1.map((row) => `${row.id}/${row.skill}`).sort());
  });

  it('covers all 18 ★ misconceptions', () => {
    expect(new Set(TABLE_4_1.map((row) => row.id)).size).toBe(18);
    expect(CATALOG.map((entry) => entry.id)).toEqual([...new Set(TABLE_4_1.map((row) => row.id))]);
  });

  it('returns nothing for a pair the table does not list', () => {
    expect(probeLevels('dim', 'M09_MULT_ELEMENTWISE')).toEqual([]);
  });

  it('honours variant limits', () => {
    expect(probeLevels('inv2', 'M20_INV2_RECIPE', 'NO_DIVIDE')).toEqual([2, 3]);
    expect(probeLevels('inv2', 'M20_INV2_RECIPE', 'TIMES_DET')).toEqual([2, 3]);
    expect(probeLevels('inv2', 'M20_INV2_RECIPE', 'NO_SWAP')).toEqual([1, 2, 3]);
    expect(probeLevels('transpose', 'M03_TRANSPOSE_WRONG', 'FLIP_H')).toEqual([1, 3]);
    expect(probeLevels('transpose', 'M03_TRANSPOSE_WRONG', 'ROT_CW')).toEqual([1, 2, 3]);
  });

  it('rejects a variant the misconception does not have', () => {
    expect(probeLevels('inv2', 'M20_INV2_RECIPE', 'NOPE')).toEqual([]);
  });
});

describe('probeLevel', () => {
  it('returns the nearest listed level for every requested level', () => {
    for (const { id, skill, levels } of TABLE_4_1) {
      for (const level of [1, 2, 3] as const) {
        const chosen = probeLevel(skill, id, level);
        expect(levels).toContain(chosen);
        const nearest = Math.min(...levels.map((l) => Math.abs(l - level)));
        expect(Math.abs(chosen - level)).toBe(nearest);
      }
    }
  });

  it('keeps a NO_DIVIDE probe away from L1, where det = ±1 hides the bug', () => {
    expect(probeLevel('inv2', 'M20_INV2_RECIPE', 1)).toBe(1);
    expect(probeLevel('inv2', 'M20_INV2_RECIPE', 1, 'NO_DIVIDE')).toBe(2);
    expect(probeLevel('inv2', 'M20_INV2_RECIPE', 1, 'TIMES_DET')).toBe(2);
  });

  it('breaks a tie towards the easier level', () => {
    expect(probeLevel('transpose', 'M03_TRANSPOSE_WRONG', 2, 'FLIP_V')).toBe(1);
  });

  it('throws for a pair the table does not list', () => {
    expect(() => probeLevel('dim', 'M09_MULT_ELEMENTWISE', 1)).toThrow(/M09/);
  });
});

describe('every row × level of §4.1 builds a probe and catches it', () => {
  for (const { id, skill, levels } of TABLE_4_1) {
    for (const level of levels) {
      it(`${id} on ${skill} L${level}`, () => {
        fc.assert(
          fc.property(seedArb, (seed) => {
            const item = generate({ skill, difficulty: level, seed, target: id });
            expect(item.ref.difficulty).toBe(level);
            expectProbe(item, id);
          }),
        );
      });
    }
  }
});

describe('every variant × level builds a probe and catches it', () => {
  for (const { id, skill, levels } of TABLE_4_1) {
    for (const variant of variantsOf(id)) {
      if (variant === undefined) continue;
      const limited = VARIANT_LEVELS[id]?.[variant] ?? levels;
      for (const level of limited) {
        it(`${id}:${variant} on ${skill} L${level}`, () => {
          fc.assert(
            fc.property(seedArb, (seed) => {
              const item = generate({
                skill,
                difficulty: level,
                seed,
                target: id,
                targetVariant: variant,
              });
              expectProbe(item, id, variant);
            }),
          );
        });
      }
    }
  }
});

describe('shapes that §4.1 prescribes', () => {
  const shapeOf = (item: MatrixItem) => {
    if (item.data.form !== 'mult') throw new Error('expected a mult item');
    const { A, B } = item.data;
    return `${A.length}×${A[0].length}·${B.length}×${B[0].length}`;
  };

  it.each<[MisconceptionId, Level]>([
    ['M09_MULT_ELEMENTWISE', 1],
    ['M09_MULT_ELEMENTWISE', 2],
    ['M10_MULT_ROW_ROW', 1],
    ['M10_MULT_ROW_ROW', 2],
    ['M11_MULT_COMMUTATIVE', 1],
    ['M11_MULT_COMMUTATIVE', 2],
  ])('%s on mult L%i uses 2×2', (id, level) => {
    fc.assert(
      fc.property(seedArb, (seed) => {
        const item = generate({ skill: 'mult', difficulty: level, seed, target: id });
        expect(shapeOf(item)).toBe('2×2·2×2');
      }),
    );
  });

  it('M10 ROW_ROW at L3 uses 2×3·3×3', () => {
    fc.assert(
      fc.property(seedArb, (seed) => {
        const item = generate({
          skill: 'mult',
          difficulty: 3,
          seed,
          target: 'M10_MULT_ROW_ROW',
          targetVariant: 'ROW_ROW',
        });
        expect(shapeOf(item)).toBe('2×3·3×3');
      }),
    );
  });

  it('M10 COL_COL at L3 uses 3×3·3×1', () => {
    fc.assert(
      fc.property(seedArb, (seed) => {
        const item = generate({
          skill: 'mult',
          difficulty: 3,
          seed,
          target: 'M10_MULT_ROW_ROW',
          targetVariant: 'COL_COL',
        });
        expect(shapeOf(item)).toBe('3×3·3×1');
      }),
    );
  });

  it('M10 at L3 with no variant still produces one of the two shapes', () => {
    fc.assert(
      fc.property(seedArb, (seed) => {
        const item = generate({ skill: 'mult', difficulty: 3, seed, target: 'M10_MULT_ROW_ROW' });
        expect(['2×3·3×3', '3×3·3×1']).toContain(shapeOf(item));
      }),
    );
  });

  it('M11 on mult_noncomm is a choice at L1 and L3 and a matrix at L2', () => {
    const kinds = ([1, 2, 3] as const).map(
      (difficulty) =>
        generate({ skill: 'mult_noncomm', difficulty, seed: 7, target: 'M11_MULT_COMMUTATIVE' })
          .kind,
    );
    expect(kinds).toEqual(['choice', 'matrix', 'choice']);
  });

  it('M04 probes have unequal dims and M05 probes have equal dims', () => {
    fc.assert(
      fc.property(seedArb, fc.constantFrom<Level>(2, 3), (seed, difficulty) => {
        const m04 = generate({ skill: 'addsub', difficulty, seed, target: 'M04_ADD_DIM_MISMATCH' });
        expect(m04.correct).toEqual({ kind: 'undefined' });
        const m05 = generate({ skill: 'addsub', difficulty, seed, target: 'M05_SUB_REVERSED' });
        expect(m05.correct.kind).toBe('matrix');
      }),
    );
  });

  it('M20 NO_SWAP probes use a and d that differ a lot', () => {
    fc.assert(
      fc.property(seedArb, fc.constantFrom<Level>(1, 2, 3), (seed, difficulty) => {
        const item = generate({
          skill: 'inv2',
          difficulty,
          seed,
          target: 'M20_INV2_RECIPE',
          targetVariant: 'NO_SWAP',
        });
        if (item.data.form !== 'inv2') throw new Error('expected an inv2 item');
        const [[a], [, d]] = item.data.A;
        expect(a.abs().sub(d.abs()).abs().compare(Rational.of(3))).toBeGreaterThanOrEqual(0);
      }),
    );
  });
});

describe('generate refuses a probe the table does not allow', () => {
  it('throws for a level outside the table, since callers must use probeLevel first', () => {
    expect(() =>
      generate({ skill: 'addsub', difficulty: 1, seed: 1, target: 'M05_SUB_REVERSED' }),
    ).toThrow(/M05/);
    expect(() =>
      generate({
        skill: 'inv2',
        difficulty: 1,
        seed: 1,
        target: 'M20_INV2_RECIPE',
        targetVariant: 'NO_DIVIDE',
      }),
    ).toThrow(/NO_DIVIDE/);
  });

  it('throws for a misconception on the wrong skill', () => {
    expect(() =>
      generate({ skill: 'dim', difficulty: 1, seed: 1, target: 'M09_MULT_ELEMENTWISE' }),
    ).toThrow(/M09/);
  });
});
