import { describe, expect, it } from 'vitest';
import { Rational } from '@/lib/core/rational';
import type { Level } from '@/lib/core/types';
import { assemble } from './generators';
import { matrix } from './ops';
import { validateMatrixItem } from './rules';
import type { SkillId } from './skills';
import type { MatrixData, MatrixItem } from './types';

const check = (skill: SkillId, level: Level, data: MatrixData) =>
  validateMatrixItem(assemble(skill, level, data));

describe('rule 5: numbers fit the level', () => {
  it('rejects grid values outside the range of SPEC §3', () => {
    const big = matrix([
      [6, 1],
      [2, 3],
    ]);
    const fine = matrix([
      [5, 1],
      [2, 3],
    ]);
    expect(check('mult', 1, { form: 'mult', A: big, B: fine })).toMatchObject({
      ok: false,
      failure: { rule: 5 },
    });
    const negative = matrix([
      [-1, 2],
      [3, 4],
    ]);
    expect(check('mult', 1, { form: 'mult', A: negative, B: fine })).toMatchObject({
      ok: false,
      failure: { rule: 5 },
    });
  });

  it('rejects a subproduct above 60 at L1–L2', () => {
    const A = matrix([
      [9, 1],
      [2, 8],
    ]);
    expect(check('det2', 1, { form: 'det2', A })).toMatchObject({
      ok: false,
      failure: { rule: 5, detail: expect.stringContaining('72') },
    });
  });

  it('counts each Sarrus product as a subproduct at det3', () => {
    const A = matrix([
      [1, 5, 1],
      [1, 1, 5],
      [5, 0, 0],
    ]);
    expect(check('det3', 1, { form: 'det3', A })).toMatchObject({
      ok: false,
      failure: { rule: 5, detail: expect.stringContaining('125') },
    });
  });

  it('rejects a result above 150 at L1–L2', () => {
    expect(check('det_props', 2, { form: 'det_scaled', n: 3, d: 6, k: 3 })).toMatchObject({
      ok: false,
      failure: { rule: 5, detail: expect.stringContaining('162') },
    });
  });

  it('applies a looser cap at L3', () => {
    const A = matrix([
      [6, 1, 2],
      [1, 6, 1],
      [1, 1, 6],
    ]);
    expect(check('det3', 3, { form: 'det3', A })).toEqual({ ok: true });
    const tooBig = matrix([
      [6, -4, 6],
      [-4, 6, 6],
      [6, 6, -4],
    ]);
    expect(check('det3', 3, { form: 'det3', A: tooBig })).toMatchObject({
      ok: false,
      failure: { rule: 5 },
    });
  });

  it('enforces the structure each level promises', () => {
    const zeros = (a: number) =>
      matrix([
        [a, 1, 2],
        [3, 1, 4],
        [2, 1, 5],
      ]);
    expect(check('det3', 1, { form: 'det3', A: zeros(0) })).toMatchObject({ ok: false });
    expect(check('det3', 2, { form: 'det3', A: zeros(3) })).toMatchObject({ ok: false });

    const noNegative = matrix([
      [2, 1],
      [3, 4],
    ]);
    expect(check('det2', 2, { form: 'det2', A: noNegative })).toMatchObject({ ok: false });
    const negativeDet = matrix([
      [1, 2],
      [3, 4],
    ]);
    expect(check('det2', 1, { form: 'det2', A: negativeDet })).toMatchObject({ ok: false });

    expect(
      check('invertible', 2, {
        form: 'invertible',
        A: matrix([
          [1, 2],
          [3, 4],
        ]),
      }),
    ).toMatchObject({ ok: false });
    expect(
      check('invertible', 1, {
        form: 'invertible',
        A: matrix([
          [0, 2],
          [3, 4],
        ]),
      }),
    ).toMatchObject({ ok: false });

    expect(check('scalar', 1, { form: 'scalar', k: 4, A: noNegative })).toMatchObject({
      ok: false,
    });
  });

  it('rejects repeated values where the level promises none', () => {
    const repeated = matrix([
      [5, 8, 1],
      [2, 7, 4],
      [9, 3, 5],
    ]);
    expect(check('index', 1, { form: 'index', A: repeated, i: 2, j: 3 })).toMatchObject({
      ok: false,
      failure: { rule: 5 },
    });
    expect(
      check('transpose', 1, {
        form: 'transpose',
        A: matrix([
          [1, 1],
          [3, 4],
        ]),
      }),
    ).toMatchObject({ ok: false });
  });

  it('enforces the determinant size of inv2 levels', () => {
    const unit = matrix([
      [3, 2],
      [1, 1],
    ]);
    const two = matrix([
      [3, 1],
      [4, 2],
    ]);
    const six = matrix([
      [4, 1],
      [2, 2],
    ]);
    expect(check('inv2', 1, { form: 'inv2', A: unit })).toEqual({ ok: true });
    expect(check('inv2', 1, { form: 'inv2', A: two })).toMatchObject({ ok: false });
    expect(check('inv2', 2, { form: 'inv2', A: two })).toEqual({ ok: true });
    expect(check('inv2', 2, { form: 'inv2', A: unit })).toMatchObject({ ok: false });
    expect(check('inv2', 2, { form: 'inv2', A: six })).toMatchObject({ ok: false });
    // L3 needs det < 0 and a fractional inverse.
    expect(check('inv2', 3, { form: 'inv2', A: two })).toMatchObject({ ok: false });
  });

  it('rejects an inverse denominator above 12', () => {
    const A = matrix([
      [-5, 2],
      [4, -1],
    ]);
    expect(check('inv2', 3, { form: 'inv2', A })).toEqual({ ok: true });
    const denominatorThirteen = matrix([
      [2, 9],
      [3, 7],
    ]);
    expect(check('inv2', 3, { form: 'inv2', A: denominatorThirteen })).toMatchObject({
      ok: false,
      failure: { rule: 5, detail: expect.stringContaining('denominator') },
    });
    expect(check('det_props', 3, { form: 'det_inverse', d: 13 })).toMatchObject({
      ok: false,
      failure: { rule: 5 },
    });
  });

  it('rejects an AB on screen that is not the real product', () => {
    const A = matrix([
      [2, 1],
      [3, 4],
    ]);
    const B = matrix([
      [1, 5],
      [2, 0],
    ]);
    const wrong = matrix([
      [4, 10],
      [11, 16],
    ]);
    expect(check('mult_noncomm', 2, { form: 'noncomm_find_ba', A, B, AB: wrong })).toMatchObject({
      ok: false,
      failure: { rule: 5 },
    });
  });
});

describe('rule 6: inverses are checked exactly', () => {
  function tampered(): MatrixItem {
    return assemble('inv2', 2, {
      form: 'inv2',
      A: matrix([
        [3, 1],
        [4, 2],
      ]),
    });
  }

  it('rejects an answer key where A·A⁻¹ ≠ I', () => {
    const item = tampered();
    const wrong = matrix([
      [1, '-1/2'],
      [-2, '5/2'],
    ]);
    expect(
      validateMatrixItem({ ...item, correct: { kind: 'matrix', value: wrong } }),
    ).toMatchObject({
      ok: false,
      failure: { rule: 6 },
    });
  });

  it('rejects an invertible answer that disagrees with det', () => {
    const item = assemble('invertible', 1, {
      form: 'invertible',
      A: matrix([
        [2, 4],
        [1, 2],
      ]),
    });
    expect(
      validateMatrixItem({
        ...item,
        correct: { kind: 'choice', id: 'has_inverse' },
        diagnostics: [],
      }),
    ).toMatchObject({ ok: false, failure: { rule: 6 } });
  });
});

describe('rule 4 through the catalog', () => {
  it('rejects a target that does not apply to these numbers', () => {
    const item = assemble(
      'det2',
      1,
      {
        form: 'det2',
        A: matrix([
          [2, 0],
          [3, 4],
        ]),
      },
      { target: 'M12_DET2_FORMULA' },
    );
    expect(validateMatrixItem(item)).toMatchObject({ ok: false, failure: { rule: 4 } });
  });

  it('rejects an M19 target on a matrix with no zero', () => {
    const item = assemble(
      'invertible',
      2,
      {
        form: 'invertible',
        A: matrix([
          [1, 2],
          [3, 4],
        ]),
      },
      { target: 'M19_INV_ZERO_ENTRY' },
    );
    expect(validateMatrixItem(item)).toMatchObject({ ok: false, failure: { rule: 4 } });
  });
});

describe('rule 2 through the catalog', () => {
  // b = c makes PAIRS_ROW and PAIRS_COL the same number.
  const A = matrix([
    [5, 2],
    [2, 3],
  ]);

  it('drops the later variant when two non-target diagnostics collide', () => {
    const item = assemble('det2', 1, { form: 'det2', A });
    const variants = item.diagnostics.map((d) => d.variant);
    expect(variants).toContain('PAIRS_ROW');
    expect(variants).not.toContain('PAIRS_COL');
    expect(validateMatrixItem(item)).toEqual({ ok: true });
  });

  it('keeps both when the collision involves the target, so the item is rejected', () => {
    const item = assemble('det2', 1, { form: 'det2', A }, { target: 'M12_DET2_FORMULA' });
    expect(validateMatrixItem(item)).toMatchObject({ ok: false, failure: { rule: 2 } });
  });
});

describe('rule 1 through the catalog', () => {
  it('rejects det3 when b = 0, since NO_ALT_SIGN then equals det', () => {
    const A = matrix([
      [2, 0, 3],
      [0, -1, 4],
      [1, 2, 1],
    ]);
    expect(check('det3', 2, { form: 'det3', A })).toMatchObject({
      ok: false,
      failure: { rule: 1 },
    });
  });

  it('rejects det2 when b = d, since PAIRS_ROW then equals det', () => {
    const A = matrix([
      [3, 2],
      [1, 2],
    ]);
    expect(check('det2', 1, { form: 'det2', A })).toMatchObject({
      ok: false,
      failure: { rule: 1 },
    });
  });

  it('rejects a commuting pair in mult, since BA then equals AB only if M11 applied', () => {
    const A = matrix([
      [1, 2],
      [3, 4],
    ]);
    const item = assemble('mult', 1, { form: 'mult', A, B: A });
    expect(item.diagnostics.map((d) => d.id)).not.toContain('M11_MULT_COMMUTATIVE');
  });
});

describe('Rational values stay exact through validation', () => {
  it('passes a fractional inverse without floats', () => {
    const item = assemble('inv2', 2, {
      form: 'inv2',
      A: matrix([
        [3, 1],
        [4, 2],
      ]),
    });
    if (item.correct.kind !== 'matrix') throw new Error('expected a matrix');
    expect(item.correct.value[0][1]).toEqual(Rational.of(-1, 2));
  });
});
