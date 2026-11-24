import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { classify } from '@/lib/core/classify';
import type { Level } from '@/lib/core/types';
import { generate } from './generators';
import { CATALOG, isRightBox, probeLevel, probeLevels, variantsOf } from './misconceptions';
import { norm, triple } from './ops';
import { validateVectorItem } from './rules';
import type { SkillId } from './skills';
import type { MisconceptionId, VectorItem } from './types';

// Typed by hand from docs/VECTORS.md §4.1 so the implementation has something to disagree with.
const TABLE_4_1: { id: MisconceptionId; skill: SkillId; levels: Level[] }[] = [
  { id: 'V01_QUANTITY_MIX', skill: 'v_quantity', levels: [1] },
  { id: 'V02_EQUAL_IGNORES_DIRECTION', skill: 'v_quantity', levels: [2, 3] },
  { id: 'V03_GEOM_SUB_DIRECTION', skill: 'v_geom', levels: [2, 3] },
  { id: 'V04_GEOM_ADD_JOIN_TIPS', skill: 'v_geom', levels: [2] },
  { id: 'V05_POINTS_REVERSED', skill: 'v_points', levels: [1, 2] },
  { id: 'V06_SCALAR_PARTIAL', skill: 'v_linear', levels: [1, 2, 3] },
  { id: 'V07_COMBO_SIGN', skill: 'v_linear', levels: [2, 3] },
  { id: 'V08_PARALLEL_RATIO_FLIP', skill: 'v_parallel', levels: [1, 2, 3] },
  { id: 'V09_MAG_NO_ROOT', skill: 'v_magnitude', levels: [1, 2, 3] },
  { id: 'V10_MAG_SUM_COMPONENTS', skill: 'v_magnitude', levels: [1, 2, 3] },
  { id: 'V11_MAG_ADDITIVE', skill: 'v_magnitude', levels: [3] },
  { id: 'V12_UNIT_SQUARED', skill: 'v_unit', levels: [1, 2, 3] },
  { id: 'V13_UNIT_DIVIDE_SUM', skill: 'v_unit', levels: [1, 2, 3] },
  { id: 'V14_DOT_AS_DET', skill: 'v_dot', levels: [1] },
  { id: 'V15_DOT_NO_COS', skill: 'v_dot', levels: [3] },
  { id: 'V16_DOT_SIN', skill: 'v_dot', levels: [3] },
  { id: 'V17_ANGLE_ABS', skill: 'v_angle', levels: [2, 3] },
  { id: 'V18_ANGLE_SQUARED_NORMS', skill: 'v_angle', levels: [1] },
  { id: 'V19_PERP_AS_PARALLEL', skill: 'v_perp', levels: [1, 2] },
  { id: 'V20_CROSS_MIDDLE_SIGN', skill: 'v_cross', levels: [1, 2, 3] },
  { id: 'V21_CROSS_ORDER', skill: 'v_cross', levels: [1, 2, 3] },
  { id: 'V22_CROSS_COMPONENTWISE', skill: 'v_cross', levels: [1, 2, 3] },
  { id: 'V23_TRIANGLE_NO_HALF', skill: 'v_area', levels: [2, 3] },
  { id: 'V24_AREA_DOT', skill: 'v_area', levels: [1, 2, 3] },
  { id: 'V25_VOLUME_SIGNED', skill: 'v_volume', levels: [1, 2] },
  { id: 'V26_VOLUME_MAG_PRODUCT', skill: 'v_volume', levels: [1, 2] },
];

const seedArb = fc.integer({ min: 0, max: 0xffffffff });

function expectProbe(item: VectorItem, id: MisconceptionId, variant?: string) {
  expect(validateVectorItem(item)).toEqual({ ok: true });
  expect(item.ref.target).toBe(id);
  expect(item.diagnostics[0].id).toBe(id);
  if (variant !== undefined) expect(item.diagnostics[0].variant).toBe(variant);
  for (const diagnostic of item.diagnostics) {
    if (diagnostic.answer.kind === 'any_matrix') throw new Error('no ANY_MATRIX in vectors');
    const expected =
      diagnostic.variant === undefined
        ? { type: 'misconception', id: diagnostic.id }
        : { type: 'misconception', id: diagnostic.id, variant: diagnostic.variant };
    expect(classify(item, diagnostic.answer)).toEqual(expected);
  }
}

const probe = (skill: SkillId, difficulty: Level, seed: number, target: MisconceptionId) =>
  generate({ skill, difficulty, seed, target });

describe('probeLevel examples', () => {
  it.each<[SkillId, MisconceptionId, Level, Level]>([
    ['v_geom', 'V04_GEOM_ADD_JOIN_TIPS', 3, 2],
    ['v_geom', 'V03_GEOM_SUB_DIRECTION', 1, 2],
    ['v_points', 'V05_POINTS_REVERSED', 3, 2],
    ['v_linear', 'V07_COMBO_SIGN', 1, 2],
    ['v_magnitude', 'V11_MAG_ADDITIVE', 1, 3],
    ['v_dot', 'V14_DOT_AS_DET', 3, 1],
    ['v_dot', 'V15_DOT_NO_COS', 1, 3],
    ['v_angle', 'V17_ANGLE_ABS', 1, 2],
    ['v_angle', 'V18_ANGLE_SQUARED_NORMS', 3, 1],
    ['v_perp', 'V19_PERP_AS_PARALLEL', 3, 2],
    ['v_area', 'V23_TRIANGLE_NO_HALF', 1, 2],
    ['v_volume', 'V25_VOLUME_SIGNED', 3, 2],
    ['v_quantity', 'V02_EQUAL_IGNORES_DIRECTION', 1, 2],
    ['v_cross', 'V20_CROSS_MIDDLE_SIGN', 2, 2],
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

  it('covers all 26 misconceptions, in catalog order', () => {
    expect(new Set(TABLE_4_1.map((row) => row.id)).size).toBe(26);
    expect(CATALOG.map((entry) => entry.id)).toEqual([...new Set(TABLE_4_1.map((row) => row.id))]);
  });

  // The note under §4.1 names only V11, but its own table also puts V15 and V16 at L3 alone.
  it('every misconception but V11, V15 and V16 has an L1 or L2 row', () => {
    const lateOnly = TABLE_4_1.filter(({ levels }) => levels.every((level) => level === 3));
    expect(lateOnly.map(({ id }) => id)).toEqual([
      'V11_MAG_ADDITIVE',
      'V15_DOT_NO_COS',
      'V16_DOT_SIN',
    ]);
  });

  it('returns nothing for a pair the table does not list', () => {
    expect(probeLevels('v_dot', 'V20_CROSS_MIDDLE_SIGN')).toEqual([]);
  });

  it('rejects a variant the misconception does not have', () => {
    expect(probeLevels('v_cross', 'V20_CROSS_MIDDLE_SIGN', 'NOPE')).toEqual([]);
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

  it('breaks a tie towards the easier level', () => {
    expect(probeLevel('v_geom', 'V03_GEOM_SUB_DIRECTION', 1)).toBe(2);
    expect(probeLevel('v_points', 'V05_POINTS_REVERSED', 3)).toBe(2);
  });

  it('throws for a pair the table does not list', () => {
    expect(() => probeLevel('v_dot', 'V20_CROSS_MIDDLE_SIGN', 1)).toThrow(/V20/);
  });
});

describe('every row × level of §4.1 builds a probe and catches it', () => {
  for (const { id, skill, levels } of TABLE_4_1) {
    for (const level of levels) {
      it(`${id} on ${skill} L${level}`, () => {
        fc.assert(
          fc.property(seedArb, (seed) => {
            const item = probe(skill, level, seed, id);
            expect(item.ref.difficulty).toBe(level);
            expectProbe(item, id);
          }),
        );
      });
    }
  }
});

describe('every variant × level builds a probe and catches it', () => {
  it('no vector misconception has named variants yet', () => {
    for (const { id } of TABLE_4_1) expect(variantsOf(id)).toEqual([undefined]);
  });
});

describe('probes have the shape §4 prescribes', () => {
  it('V04 probes add two vectors from one corner; V03 probes subtract', () => {
    fc.assert(
      fc.property(seedArb, fc.constantFrom<Level>(2, 3), (seed, difficulty) => {
        const sub = probe('v_geom', difficulty, seed, 'V03_GEOM_SUB_DIRECTION');
        if (sub.data.form !== 'figure_expr') throw new Error('form');
        expect(sub.data.expr[1].k.sign()).toBeLessThan(0);
        if (difficulty === 3) return;
        const add = probe('v_geom', 2, seed, 'V04_GEOM_ADD_JOIN_TIPS');
        if (add.data.form !== 'figure_expr') throw new Error('form');
        expect(add.data.expr.every((t) => t.k.sign() > 0)).toBe(true);
        expect(add.data.expr[0].from).toBe(add.data.expr[1].from);
      }),
    );
  });

  it('V06 at L1 uses ku in 3D, where it changes two components', () => {
    fc.assert(
      fc.property(seedArb, (seed) => {
        const item = probe('v_linear', 1, seed, 'V06_SCALAR_PARTIAL');
        if (item.data.form !== 'linear') throw new Error('form');
        expect(item.data.terms).toHaveLength(1);
        expect(item.data.terms[0].vec).toHaveLength(3);
      }),
    );
  });

  it('V11 probes are |pu + qv| where |pu| + |qv| is one Surd', () => {
    fc.assert(
      fc.property(seedArb, (seed) => {
        const item = probe('v_magnitude', 3, seed, 'V11_MAG_ADDITIVE');
        if (item.data.form !== 'magnitude_combo') throw new Error('form');
        const [u, v] = item.data.terms.map((t) => t.vec);
        expect(norm(u).addSame(norm(v))).not.toBeNull();
      }),
    );
  });

  it('V14 probes are 2D', () => {
    fc.assert(
      fc.property(seedArb, (seed) => {
        const item = probe('v_dot', 1, seed, 'V14_DOT_AS_DET');
        if (item.data.form !== 'dot') throw new Error('form');
        expect(item.data.u).toHaveLength(2);
      }),
    );
  });

  it('V16 probes never use 45° (nor 90°, where V15 says the same)', () => {
    fc.assert(
      fc.property(seedArb, (seed) => {
        const item = probe('v_dot', 3, seed, 'V16_DOT_SIN');
        if (item.data.form !== 'dot_polar') throw new Error('form');
        expect([45, 90]).not.toContain(item.data.theta);
      }),
    );
  });

  it('V17 probes at L2 use an obtuse angle', () => {
    fc.assert(
      fc.property(seedArb, (seed) => {
        const item = probe('v_angle', 2, seed, 'V17_ANGLE_ABS');
        if (item.data.form !== 'angle') throw new Error('form');
        expect(item.data.theta).toBeGreaterThan(90);
      }),
    );
  });

  it('V25 probes are negative before the absolute value; V26 probes are never a right box', () => {
    fc.assert(
      fc.property(seedArb, fc.constantFrom<Level>(1, 2), (seed, difficulty) => {
        const signed = probe('v_volume', difficulty, seed, 'V25_VOLUME_SIGNED');
        if (signed.data.form !== 'volume') throw new Error('form');
        expect(triple(signed.data.u, signed.data.v, signed.data.w).sign()).toBe(-1);
        const slanted = probe('v_volume', difficulty, seed, 'V26_VOLUME_MAG_PRODUCT');
        if (slanted.data.form !== 'volume') throw new Error('form');
        expect(isRightBox(slanted.data.u, slanted.data.v, slanted.data.w)).toBe(false);
      }),
    );
  });

  it('V20 probes differ in the middle component only, by its negation, with |c₂| ≥ 2', () => {
    fc.assert(
      fc.property(seedArb, fc.constantFrom<Level>(1, 2, 3), (seed, difficulty) => {
        const item = probe('v_cross', difficulty, seed, 'V20_CROSS_MIDDLE_SIGN');
        const [first] = item.diagnostics;
        if (first.answer.kind !== 'vector' || item.correct.kind !== 'vector')
          throw new Error('kind');
        const [c1, c2, c3] = item.correct.value;
        expect(first.oneOff).toBe(true);
        expect(first.answer.value).toEqual([c1, c2.neg(), c3]);
        expect(Math.abs(c2.toRational().n)).toBeGreaterThanOrEqual(2);
      }),
    );
  });
});

describe('generate refuses a probe the table does not allow', () => {
  it('throws for a level outside the table, since callers must use probeLevel first', () => {
    expect(() =>
      generate({ skill: 'v_geom', difficulty: 1, seed: 1, target: 'V03_GEOM_SUB_DIRECTION' }),
    ).toThrow(/V03/);
    expect(() =>
      generate({ skill: 'v_magnitude', difficulty: 2, seed: 1, target: 'V11_MAG_ADDITIVE' }),
    ).toThrow(/V11/);
  });

  it('throws for a misconception on the wrong skill', () => {
    expect(() =>
      generate({ skill: 'v_dot', difficulty: 1, seed: 1, target: 'V20_CROSS_MIDDLE_SIGN' }),
    ).toThrow(/V20/);
  });
});
