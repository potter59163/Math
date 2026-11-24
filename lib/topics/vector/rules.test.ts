import { describe, expect, it } from 'vitest';
import { Rational } from '@/lib/core/rational';
import { Surd } from '@/lib/core/surd';
import type { Level } from '@/lib/core/types';
import { validateItem } from '@/lib/core/validate';
import { assemble } from './generators';
import { vec } from './ops';
import { limitProblem, validateVectorItem, vectorRules } from './rules';
import type { SkillId } from './skills';
import type { Figure, PointLabel, Term, VectorData, VectorItem } from './types';

const check = (skill: SkillId, level: Level, data: VectorData) =>
  validateVectorItem(assemble(skill, level, data));

const r = (value: number) => Rational.of(value);
const one = (from: PointLabel, to: PointLabel): Term => ({ k: Rational.ONE, from, to });

const ABCD: Figure = {
  shape: 'parallelogram',
  outline: ['A', 'B', 'C', 'D'],
  points: [
    { label: 'A', at: [0, 0] },
    { label: 'B', at: [4, 0] },
    { label: 'C', at: [5, 3] },
    { label: 'D', at: [1, 3] },
  ],
  midpoints: [],
};

describe('rule 5: numbers fit docs/VECTORS.md §2', () => {
  it('rejects a given component above 9', () => {
    expect(check('v_dot', 1, { form: 'dot', u: vec(10, 1), v: vec(1, 1) })).toMatchObject({
      ok: false,
      failure: { rule: 5, detail: expect.stringContaining('10') },
    });
  });

  it('rejects a partial product above 60, squares included', () => {
    expect(check('v_dot', 1, { form: 'dot', u: vec(9, 1), v: vec(8, 1) })).toMatchObject({
      ok: false,
      failure: { rule: 5, detail: expect.stringContaining('72') },
    });
    expect(check('v_magnitude', 1, { form: 'magnitude', v: vec(8, 1) })).toMatchObject({
      ok: false,
      failure: { rule: 5, detail: expect.stringContaining('64') },
    });
  });

  it('rejects a result above 150', () => {
    const data: VectorData = {
      form: 'linear',
      terms: [
        { k: 4, name: 'u', vec: vec(9, -9, 9) },
        { k: -4, name: 'v', vec: vec(-9, 9, -9) },
      ],
      notation: 'tuple',
    };
    expect(limitProblem(data)).toBeNull();
    const big: VectorData = {
      form: 'volume',
      u: vec(7, -7, 0),
      v: vec(7, 7, 0),
      w: vec(0, 0, 7),
    };
    expect(limitProblem(big)).toMatch(/exceeds/);
  });

  it('rejects an answer whose radicand is above 200 after simplifying', () => {
    expect(limitProblem({ form: 'magnitude', v: vec(7, 7, 7) })).toBeNull();
    expect(limitProblem({ form: 'distance', A: vec(-6, -6, -6), B: vec(1, 1, 1) })).toBeNull();
    // cos θ = 11/√221 = 11√221/221.
    expect(limitProblem({ form: 'cos_angle', u: vec(1, 4), v: vec(3, 2) })).toMatch(/radicand 221/);
  });

  it('rejects an answer whose denominator is above 12', () => {
    expect(limitProblem({ form: 'unit', v: vec(1, 2, 3) })).toMatch(/denominator 14/);
    expect(limitProblem({ form: 'unit', v: vec(1, -1, 2) })).toBeNull();
  });

  it('enforces the structure each level promises', () => {
    expect(check('v_dot', 1, { form: 'dot', u: vec(1, 2, 3), v: vec(1, 1, 1) })).toMatchObject({
      ok: false,
      failure: { rule: 5, detail: 'v_dot L1 is 2D' },
    });
    expect(
      check('v_cross', 1, { form: 'cross', u: vec(1, 2, 3), v: vec(3, 1, 2), order: 'uv' }),
    ).toMatchObject({ ok: false, failure: { rule: 5 } });
    expect(
      check('v_cross', 2, { form: 'cross', u: vec(1, 2, 3), v: vec(3, 1, 2), order: 'vu' }),
    ).toMatchObject({ ok: false, failure: { rule: 5 } });
    expect(
      check('v_volume', 2, { form: 'volume', u: vec(1, 2, 0), v: vec(0, 1, 3), w: vec(2, 0, 1) }),
    ).toMatchObject({
      ok: false,
      failure: { rule: 5, detail: expect.stringContaining('negative') },
    });
    expect(
      check('v_area', 3, {
        form: 'area_triangle',
        A: vec(1, 0, 1),
        B: vec(2, 2, 1),
        C: vec(4, 1, 3),
      }),
    ).toMatchObject({ ok: false, failure: { rule: 5 } });
    expect(check('v_unit', 3, { form: 'unit', v: vec(1, 2, 2) })).toMatchObject({
      ok: false,
      failure: { rule: 5, detail: expect.stringContaining('root') },
    });
  });

  it('only allows the standard angles of each level', () => {
    expect(
      check('v_angle', 3, { form: 'angle', u: vec(1, 0, 0), v: vec(1, 1, 0), theta: 45 }),
    ).toMatchObject({ ok: false, failure: { rule: 5 } });
  });
});

describe('rule 6: answers are checked exactly', () => {
  it('rejects an angle item whose vectors do not make θ', () => {
    const item = assemble('v_angle', 2, {
      form: 'angle',
      u: vec(1, 1, 0),
      v: vec(-1, 0, 1),
      theta: 120,
    });
    expect(validateVectorItem(item)).toEqual({ ok: true });
    const wrong: VectorItem = { ...item, data: { ...item.data, theta: 135 } as VectorData };
    expect(validateVectorItem(wrong)).toMatchObject({ ok: false, failure: { rule: 6 } });
  });

  it('rejects a cross product that is not perpendicular to both', () => {
    const item = assemble('v_cross', 2, {
      form: 'cross',
      u: vec(2, -1, 3),
      v: vec(1, 4, -2),
      order: 'uv',
    });
    const tampered: VectorItem = {
      ...item,
      correct: { kind: 'vector', value: [-10, 7, 8].map((n) => Surd.rational(n)) },
      diagnostics: [],
    };
    expect(validateVectorItem(tampered)).toMatchObject({ ok: false, failure: { rule: 6 } });
  });

  it('rejects parallel vectors whose given parts are not parallel', () => {
    expect(
      check('v_parallel', 2, {
        form: 'parallel',
        u: [r(2), 'm', r(-4)],
        v: [r(3), r(6), r(-5)],
        ask: 'm',
      }),
    ).toMatchObject({ ok: false, failure: { rule: 6 } });
  });

  it('rejects a perpendicular item where k has no coefficient', () => {
    expect(() =>
      assemble('v_perp', 2, { form: 'perp', u: [r(2), 'k', r(-1)], v: [r(3), r(0), r(4)] }),
    ).toThrow(/coefficient/);
  });

  it('rejects a figure item where two options are the same vector', () => {
    expect(
      check('v_quantity', 2, {
        form: 'figure_equal',
        figure: ABCD,
        of: one('A', 'B'),
        negative: false,
        options: [one('D', 'C'), one('C', 'D'), one('B', 'C'), one('A', 'D')],
      }),
    ).toMatchObject({ ok: false, failure: { rule: 5, detail: 'two options are the same vector' } });
  });

  it('rejects a flat parallelogram', () => {
    const flat: Figure = {
      ...ABCD,
      points: [
        { label: 'A', at: [0, 0] },
        { label: 'B', at: [2, 0] },
        { label: 'C', at: [6, 0] },
        { label: 'D', at: [4, 0] },
      ],
    };
    expect(
      check('v_geom', 1, {
        form: 'figure_expr',
        figure: flat,
        expr: [one('A', 'B'), one('B', 'C')],
        options: [one('A', 'C'), one('C', 'A'), one('A', 'B'), one('B', 'A')],
      }),
    ).toMatchObject({ ok: false, failure: { rule: 5 } });
  });
});

describe('V20 is the only diagnostic allowed one component away', () => {
  const item = assemble('v_cross', 2, {
    form: 'cross',
    u: vec(2, -1, 3),
    v: vec(1, 4, -2),
    order: 'uv',
  });

  it('passes as built', () => {
    expect(validateVectorItem(item)).toEqual({ ok: true });
  });

  it('rejects a oneOff on another misconception', () => {
    const v21 = item.diagnostics.find((d) => d.id === 'V21_CROSS_ORDER')!;
    const tampered: VectorItem = {
      ...item,
      diagnostics: [
        ...item.diagnostics.filter((d) => d.id !== 'V21_CROSS_ORDER'),
        {
          ...v21,
          answer: { kind: 'vector', value: [-10, 7, 8].map((n) => Surd.rational(n)) },
          oneOff: true,
        },
      ],
    };
    expect(validateVectorItem(tampered)).toMatchObject({ ok: false, failure: { rule: 6 } });
  });

  it('rejects a V20 that changes something other than the sign of the middle', () => {
    const tampered: VectorItem = {
      ...item,
      diagnostics: item.diagnostics.map((d) =>
        d.id === 'V20_CROSS_MIDDLE_SIGN'
          ? { ...d, answer: { kind: 'vector', value: [-10, 8, 9].map((n) => Surd.rational(n)) } }
          : d,
      ),
    };
    expect(validateVectorItem(tampered)).toMatchObject({ ok: false, failure: { rule: 6 } });
  });

  it('without oneOff, rule 3 rejects a one-component V20', () => {
    const tampered: VectorItem = {
      ...item,
      diagnostics: item.diagnostics.map((d) => ({ id: d.id, answer: d.answer })),
    };
    expect(validateVectorItem(tampered)).toMatchObject({ ok: false, failure: { rule: 3 } });
  });
});

describe('rule 4 through the catalog', () => {
  it('rejects a target that does not apply to these numbers', () => {
    const item = assemble(
      'v_dot',
      3,
      {
        form: 'dot_polar',
        normU: Surd.rational(4),
        normV: Surd.rational(6),
        theta: 45,
      },
      { target: 'V16_DOT_SIN' },
    );
    expect(validateVectorItem(item)).toMatchObject({ ok: false, failure: { rule: 4 } });
  });
});

describe('rule 2 through the catalog', () => {
  it('drops the later diagnostic when two non-target diagnostics collide', () => {
    const item = assemble('v_dot', 3, {
      form: 'dot_polar',
      normU: Surd.rational(4),
      normV: Surd.rational(6),
      theta: 90,
    });
    expect(item.diagnostics.map((d) => d.id)).toEqual(['V15_DOT_NO_COS']);
    expect(validateVectorItem(item)).toEqual({ ok: true });
  });

  it('keeps both when the collision involves the target, so the item is rejected', () => {
    const item = assemble(
      'v_dot',
      3,
      {
        form: 'dot_polar',
        normU: Surd.rational(4),
        normV: Surd.rational(6),
        theta: 90,
      },
      { target: 'V16_DOT_SIN' },
    );
    expect(validateVectorItem(item)).toMatchObject({ ok: false, failure: { rule: 2 } });
  });
});

describe('vectorRules plugs into the core validateItem', () => {
  it('is the same check as validateVectorItem', () => {
    const item = assemble('v_points', 2, { form: 'points', A: vec(1, -2, 3), B: vec(4, 2, -1) });
    expect(validateItem(item, vectorRules)).toEqual(validateVectorItem(item));
  });
});
