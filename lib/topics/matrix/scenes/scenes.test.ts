import fc from 'fast-check';
import katex from 'katex';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CONFIG } from '@/lib/config';
import { th } from '@/lib/content/th';
import { answersEqual, classify } from '@/lib/core/classify';
import { Rational } from '@/lib/core/rational';
import type { Answer, Level, Matrix } from '@/lib/core/types';
import { assemble, generate } from '../generators';
import { CATALOG } from '../misconceptions';
import { det2, equals, identity, matrix, mul, scalar, sum } from '../ops';
import { SKILLS, levelsOf } from '../skills';
import {
  conceptExample,
  conceptScene,
  exampleSeed,
  introScene,
  matrixWithDet,
  remediationScene,
  revealScene,
  sceneDurationMs,
  sceneLimitMs,
} from '.';
import { SCENE_COMBOS, caughtExample } from './catalog';
import { dimensionScene } from './dimensionMatch';
import { gridScene } from './gridTransform';
import { inverseScene } from './inverseRecipe';
import { rowColDotScene } from './rowColDot';
import type { AnyScene, SceneSpec } from './types';

const A = matrix([
  [2, 1],
  [3, 4],
]);
const B = matrix([
  [1, 5],
  [2, 0],
]);

const SEEDS = Array.from({ length: 40 }, (_, i) => i * 7919 + 1);

const COMBOS = SCENE_COMBOS;
const caughtScene = caughtExample;

/** Every caption is one filled-in line, and every beat has a declared length within the cap. */
function expectPlayable(spec: SceneSpec) {
  const scene = spec as AnyScene;
  expect(scene.beats.length).toBeGreaterThan(0);
  expect(new Set(scene.beats).size).toBe(scene.beats.length);
  for (const beat of scene.beats) {
    const ms = scene.beatMs[beat];
    expect(ms).toBeGreaterThan(0);
    expect(ms).toBeLessThanOrEqual(CONFIG.scenes.maxBeatMs);
    const caption = scene.captions[beat];
    if (spec.template !== 'worked_solution') expect(caption).toBeTruthy();
    if (caption) {
      expect(caption).not.toMatch(/[{}\n]/);
      expect(spacingLength(caption)).toBeLessThanOrEqual(MAX_CAPTION_SPACING);
    }
  }
  if (scene.flagged) expect(scene.beats).toContain(scene.flagged);
  expect(sceneDurationMs(spec)).toBeLessThanOrEqual(sceneLimitMs(spec.purpose));
}

// Thai vowels above and below the line and tone marks take no width of their own. 360px leaves 328px
// at 16px, and the widest caption that fit in the browser has 42 of these. It is a guard for later
// edits; the real measurement is in the browser, recorded in docs/DECISIONS.md.
const THAI_MARKS = /[ัิ-ฺ็-๎]/g;
const spacingLength = (text: string) => text.replace(THAI_MARKS, '').length;
const MAX_CAPTION_SPACING = 44;

describe('row_col_dot on the documented example', () => {
  it('works out cell (1,1) as SCENES §3.5 shows: 2·1 + 1·2 = 4', () => {
    const { params } = rowColDotScene({ left: A, right: B, cell: [1, 1], purpose: 'concept' });
    expect(params.terms.map(({ a, b, product }) => [a, b, product].map(String))).toEqual([
      ['2', '1', '2'],
      ['1', '2', '2'],
    ]);
    expect(params.product).toEqual(
      matrix([
        [4, 10],
        [11, 15],
      ]),
    );
    expect(params.names).toEqual({ left: 'A', right: 'B', result: 'AB' });
  });

  it.each<[Parameters<typeof rowColDotScene>[0]['variant'], [number, number], number]>([
    ['elementwise', [1, 1], 2],
    ['elementwise', [2, 1], 6],
    ['row_row', [1, 1], 7],
    ['row_row', [2, 1], 23],
    ['col_col', [1, 1], 8],
    ['col_col', [1, 2], 10],
    ['reversed', [1, 1], 17],
    ['reversed', [2, 2], 2],
  ])('compares %s at %j with the value from MISCONCEPTIONS §3', (variant, cell, value) => {
    const { params, beats } = rowColDotScene({
      left: A,
      right: B,
      cell: cell as [number, number],
      variant,
      purpose: 'remediate',
    });
    expect(params.wrong?.value.equals(Rational.of(value))).toBe(true);
    expect(sum(params.wrong!.terms.map((term) => term.product)).equals(Rational.of(value))).toBe(
      true,
    );
    expect(beats[0]).toBe('compare');
  });

  it('leaves out the compare beat when nothing is being compared (SCENES §5.1)', () => {
    const { beats, captions } = rowColDotScene({ left: A, right: B, purpose: 'concept' });
    expect(beats).not.toContain('compare');
    expect(captions.setup).toBe('หาช่องแถว 1 หลัก 1 ของ AB');
    expect(captions.pick_col).toBe('คู่กับหลักที่ 1 ของ B ทั้งหลัก');
  });
});

describe('dimension_match', () => {
  const dims = (rows: number, cols: number) => ({ rows, cols });

  it('reads the examples of MISCONCEPTIONS §3 (M08)', () => {
    const defined = dimensionScene({
      op: 'mult',
      first: dims(2, 3),
      second: dims(3, 4),
      purpose: 'concept',
    }).params;
    expect(defined.fits).toBe(true);
    expect(defined.result).toEqual(dims(2, 4));

    const notDefined = dimensionScene({
      op: 'mult',
      first: dims(3, 4),
      second: dims(2, 3),
      names: { first: 'B', second: 'A' },
      student: dims(3, 3),
      purpose: 'remediate',
    }).params;
    expect(notDefined.fits).toBe(false);
    expect(notDefined.result).toBeNull();
    expect(notDefined.student).toEqual(dims(3, 3));
    expect(notDefined.names).toEqual({ first: 'B', second: 'A' });
  });

  it('needs equal dims to add, and counts rows then columns in single mode', () => {
    const add = dimensionScene({
      op: 'add',
      first: dims(2, 2),
      second: dims(2, 3),
      purpose: 'remediate',
    });
    expect(add.params.fits).toBe(false);
    expect(add.params.result).toBeNull();
    expect(add.captions.result).toBe('มิติไม่เท่ากัน จึงหาค่าไม่ได้');

    const single = dimensionScene({ op: 'single', first: dims(2, 3), purpose: 'concept' });
    expect(single.beats).toEqual(['blocks', 'count_rows', 'count_cols', 'result']);
    expect(single.params.result).toEqual(dims(2, 3));
  });

  it('handles RESULT_OUTER: the outer dims on a product that cannot be computed', () => {
    const item = assemble('mult_defined', 1, {
      form: 'mult_defined',
      order: 'AB',
      dimsA: dims(3, 2),
      dimsB: dims(4, 3),
    });
    const answer: Answer = { kind: 'dims', rows: 3, cols: 3 };
    expect(classify(item, answer)).toEqual({
      type: 'misconception',
      id: 'M08_MULT_DIM_RULE',
      variant: 'RESULT_OUTER',
    });
    const spec = remediationScene(item, answer, {
      id: 'M08_MULT_DIM_RULE',
      variant: 'RESULT_OUTER',
    });
    if (spec.template !== 'dimension_match') throw new Error('wrong template');
    expect(spec.params.fits).toBe(false);
    expect(spec.params.result).toBeNull();
    expect(spec.params.student).toEqual(dims(3, 3));
    expect(spec.captions.result).toBe('ตัวในไม่เท่ากัน จึงหาค่าไม่ได้');
  });

  it('shows "undefined" when the student said so about a product that exists (SAME_DIMS)', () => {
    const item = assemble('mult_defined', 1, {
      form: 'mult_defined',
      order: 'AB',
      dimsA: dims(2, 3),
      dimsB: dims(3, 4),
    });
    const spec = remediationScene(
      item,
      { kind: 'undefined' },
      { id: 'M08_MULT_DIM_RULE', variant: 'SAME_DIMS' },
    );
    if (spec.template !== 'dimension_match') throw new Error('wrong template');
    expect(spec.params.student).toBe('undefined');
    expect(spec.params.result).toEqual(dims(2, 4));
  });

  it('names the factors in the order a BA item asks for', () => {
    const item = assemble('mult_defined', 2, {
      form: 'mult_defined',
      order: 'BA',
      dimsA: dims(2, 3),
      dimsB: dims(4, 2),
    });
    const spec = remediationScene(
      item,
      { kind: 'dims', rows: 2, cols: 2 },
      { id: 'M08_MULT_DIM_RULE', variant: 'RESULT_INNER' },
    );
    if (spec.template !== 'dimension_match') throw new Error('wrong template');
    expect(spec.params.names).toEqual({ first: 'B', second: 'A' });
    expect(spec.params.first).toEqual(dims(4, 2));
    expect(spec.params.result).toEqual(dims(4, 3));
  });
});

describe('grid_transform on the checked values of SCENES §3.3', () => {
  it('det_area: M = [[2,1],[0,1]] doubles the area, with no flip', () => {
    const M = matrix([
      [2, 1],
      [0, 1],
    ]);
    const { beats, captions, params } = gridScene({ mode: 'det_area', M, purpose: 'intro' });
    expect(beats).toEqual(['unit', 'apply', 'area']);
    expect(captions.area).toBe('พื้นที่ใหม่ = |det| = 2 เท่า');
    expect(params.frames.unit).toEqual([identity(2)]);
    expect(params.frames.apply).toEqual([M]);
  });

  it('det_area adds the flip beat when det < 0', () => {
    const M = matrix([
      [0, 1],
      [1, 0],
    ]);
    const { beats, captions } = gridScene({ mode: 'det_area', M, purpose: 'concept' });
    expect(beats).toEqual(['unit', 'apply', 'area', 'flip']);
    expect(captions.area).toBe('พื้นที่ใหม่ = |det| = 1 เท่า');
  });

  it('det_zero: [[2,4],[1,2]] flattens and cannot be undone', () => {
    const M = matrix([
      [2, 4],
      [1, 2],
    ]);
    const { beats, captions, params } = gridScene({ mode: 'det_zero', M, purpose: 'remediate' });
    expect(beats).toEqual(['unit', 'apply', 'cant_undo']);
    expect(captions.cant_undo).toBe('พื้นที่เป็น 0 ย้อนกลับไม่ได้ จึงไม่มีอินเวอร์ส');
    expect(det2(params.frames.apply![0]).isZero()).toBe(true);
  });

  it('compose: R and S differ by order, RS on the left and SR on the right', () => {
    const R = matrix([
      [0, -1],
      [1, 0],
    ]);
    const S = matrix([
      [2, 0],
      [0, 1],
    ]);
    const { params, beats } = gridScene({ mode: 'compose', M: R, N: S, purpose: 'concept' });
    expect(beats).toEqual(['unit', 'first', 'second', 'differ']);
    expect(params.frames.first).toEqual([S, R]);
    expect(params.frames.second).toEqual([
      matrix([
        [0, -1],
        [2, 0],
      ]),
      matrix([
        [0, -2],
        [1, 0],
      ]),
    ]);
  });

  it('undo: M then M⁻¹ returns to the unit square exactly', () => {
    const M = matrix([
      [0, 3],
      [2, 5],
    ]);
    const { params, beats } = gridScene({ mode: 'undo', M, purpose: 'remediate' });
    expect(beats).toEqual(['unit', 'apply', 'undo', 'back']);
    expect(params.frames.apply).toEqual([M]);
    expect(params.frames.undo).toEqual([identity(2)]);
    expect(params.shown.map(({ label }) => label)).toEqual(['A', 'A⁻¹']);
  });

  it.each<[number, number, string, string, string]>([
    [2, 2, 'ขยายทั้งสองแกน แกนละ 2 เท่า', 'พื้นที่จึงขยาย 2² = 4 เท่า', ''],
    [-2, 2, 'ขยาย 2 เท่า และกลับทิศทั้งสองแกน', 'พื้นที่จึงขยาย (−2)² = 4 เท่า', ''],
    [-1, 2, 'กลับทิศทั้งสองแกน ขนาดเท่าเดิม', 'พื้นที่จึงขยาย (−1)² = 1 เท่า', ''],
    [
      2,
      3,
      'ขยายทั้งสองแกน แกนละ 2 เท่า',
      'พื้นที่จึงขยาย 2² = 4 เท่า',
      '3×3 มีสามแกน จึงเป็น 2³ เท่า',
    ],
    [
      -3,
      3,
      'ขยาย 3 เท่า และกลับทิศทั้งสองแกน',
      'พื้นที่จึงขยาย (−3)² = 9 เท่า',
      '3×3 มีสามแกน จึงเป็น (−3)³ เท่า',
    ],
  ])('scale_k with k = %i, n = %i writes the power as it should be', (k, n, scale, area, cube) => {
    const d = 4;
    const M = matrixWithDet(d);
    const { captions, beats, params } = gridScene({
      mode: 'scale_k',
      M,
      k,
      d,
      n,
      purpose: 'remediate',
    });
    expect(captions.scale).toBe(scale);
    expect(captions.area).toBe(area);
    expect(beats.includes('cube')).toBe(n === 3);
    if (cube) expect(captions.cube).toBe(cube);
    expect(params.frames.scale).toEqual([scalar(Rational.of(k), M)]);
  });

  it('keeps every corner of every frame inside its bounds', () => {
    const M = matrix([
      [-7, 7],
      [7, 7],
    ]);
    const { params } = gridScene({ mode: 'undo', M, purpose: 'remediate' });
    const { minX, maxX, minY, maxY } = params.bounds;
    expect([minX, maxX, minY, maxY]).toEqual([-7, 7, 0, 14]);
  });
});

describe('matrixWithDet', () => {
  it('reaches every det the generators use, with small entries', () => {
    for (let d = -12; d <= 12; d += 1) {
      if (d === 0) continue;
      const M = matrixWithDet(d);
      expect(det2(M).equals(Rational.of(d))).toBe(true);
      expect(M.flat().every((cell) => cell.abs().compare(Rational.of(12)) <= 0)).toBe(true);
    }
  });
});

describe('inverse_recipe on the documented example', () => {
  const R = matrix([
    [3, 1],
    [4, 2],
  ]);

  it('A = [[3,1],[4,2]] gives det 2 and [[1, −1/2], [−2, 3/2]]', () => {
    const { params, beats, captions } = inverseScene({ A: R, purpose: 'concept' });
    expect(beats).toEqual(['show', 'swap', 'negate', 'det', 'divide']);
    expect(captions.show).toBe('อินเวอร์ส: สลับ → กลับเครื่องหมาย → หาร');
    expect(params.det.equals(Rational.of(2))).toBe(true);
    expect(params.swapped).toEqual(
      matrix([
        [2, 1],
        [4, 3],
      ]),
    );
    expect(params.adjugate).toEqual(
      matrix([
        [2, -1],
        [-4, 3],
      ]),
    );
    expect(params.inverse).toEqual(
      matrix([
        ['1', '-1/2'],
        ['-2', '3/2'],
      ]),
    );
    expect(equals(params.identity, identity(2))).toBe(true);
  });

  it.each([
    ['NO_SWAP', 'swap', 'ลืมสลับ a กับ d'],
    ['NO_NEGATE', 'negate', 'ลืมเปลี่ยนเครื่องหมาย b กับ c'],
    ['NO_DIVIDE', 'divide', 'ลืมหารด้วย det'],
    ['TIMES_DET', 'divide', 'คูณด้วย det แทนที่จะหาร'],
    ['TRANSPOSED', 'negate', 'b กับ c ไม่ต้องสลับที่ แค่เปลี่ยนเครื่องหมาย'],
    ['RECIPROCAL', 'show', 'อินเวอร์สไม่ใช่การกลับเศษทีละตัว'],
  ] as const)('%s points at the %s beat with its own caption', (variant, beat, caption) => {
    const spec = inverseScene({ A: R, variant, purpose: 'remediate' });
    expect(spec.flagged).toBe(beat);
    expect(spec.captions[beat]).toBe(caption);
  });

  it('can add the optional check beat', () => {
    expect(inverseScene({ A: R, withCheck: true, purpose: 'concept' }).beats).toContain('check');
  });
});

describe('every ★ misconception has a scene with numbers from the generator', () => {
  const entries = CATALOG.map((entry) => entry.id);

  it('covers all 18 ★ misconceptions', () => {
    expect(new Set(COMBOS.map((combo) => combo.id)).size).toBe(18);
    expect(entries).toHaveLength(18);
  });

  it.each(
    COMBOS.map((combo) => [`${combo.id} ${combo.variant ?? ''} L${combo.level}`, combo] as const),
  )('%s plays within its limit on every sampled seed', (_, combo) => {
    for (const seed of SEEDS) {
      const caught = caughtScene(combo, seed);
      if (caught) expectPlayable(caught.spec);
    }
  });

  it('holds across seeds', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...COMBOS),
        fc.integer({ min: 0, max: 0xffffffff }),
        (combo, seed) => {
          const caught = caughtScene(combo, seed);
          if (caught) expectPlayable(caught.spec);
        },
      ),
    );
  });

  it('row_col_dot adds up to the true product, and its wrong work is what the student typed', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          ...COMBOS.filter(({ id }) => ['M09_MULT_ELEMENTWISE', 'M10_MULT_ROW_ROW'].includes(id)),
        ),
        fc.integer({ min: 0, max: 0xffffffff }),
        (combo, seed) => {
          const caught = caughtScene(combo, seed);
          if (!caught || caught.spec.template !== 'row_col_dot') return;
          const { params } = caught.spec;
          const [i, j] = params.cell;
          expect(
            sum(params.terms.map((term) => term.product)).equals(params.product[i - 1][j - 1]),
          ).toBe(true);
          expect(equals(mul(params.left, params.right), params.product)).toBe(true);
          if (caught.answer.kind === 'matrix') {
            expect(params.wrong!.value.equals(caught.answer.value[i - 1][j - 1])).toBe(true);
          }
        },
      ),
    );
  });

  it('M11 on a matrix item compares against the order the item asked for', () => {
    const find = generate({
      skill: 'mult_noncomm',
      difficulty: 2,
      seed: 5,
      target: 'M11_MULT_COMMUTATIVE',
    });
    if (find.data.form !== 'noncomm_find_ba') throw new Error('wrong form');
    const answer: Answer = { kind: 'matrix', value: find.data.AB };
    const spec = remediationScene(find, answer, { id: 'M11_MULT_COMMUTATIVE' });
    if (spec.template !== 'row_col_dot') throw new Error('wrong template');
    expect(spec.params.names).toEqual({ left: 'B', right: 'A', result: 'BA' });
    expect(equals(spec.params.product, mul(find.data.B, find.data.A))).toBe(true);
    const [i, j] = spec.params.cell;
    expect(spec.params.wrong!.value.equals(find.data.AB[i - 1][j - 1])).toBe(true);
  });

  it('M14 keeps the k and d of the item, on a 2×2 whose det is that d', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 0xffffffff }),
        fc.constantFrom<Level>(1, 2),
        (seed, level) => {
          const item = generate({
            skill: 'det_props',
            difficulty: level,
            seed,
            target: 'M14_DET_SCALAR_LINEAR',
          });
          if (item.data.form !== 'det_scaled') throw new Error('wrong form');
          const { k, d, n } = item.data;
          const answer: Answer = { kind: 'scalar', value: Rational.of(k * d) };
          const spec = remediationScene(item, answer, { id: 'M14_DET_SCALAR_LINEAR' });
          if (spec.template !== 'grid_transform') throw new Error('wrong template');
          const [M] = spec.params.frames.apply!;
          expect(det2(M).equals(Rational.of(d))).toBe(true);
          expect(spec.params.frames.scale).toEqual([scalar(Rational.of(k), M)]);
          expect(spec.beats.includes('cube')).toBe(n === 3);
        },
      ),
    );
  });

  it('M18 and M19 on a 3×3 play a 2×2 from the generator that says it is an example', () => {
    for (const [id, mode] of [
      ['M18_INV_SINGULAR', 'det_zero'],
      ['M19_INV_ZERO_ENTRY', 'undo'],
    ] as const) {
      for (const seed of SEEDS) {
        const item = generate({ skill: 'invertible', difficulty: 3, seed, target: id });
        expect(item.data.form === 'invertible' && item.data.A.length).toBe(3);
        const answer: Answer = {
          kind: 'choice',
          id: id === 'M18_INV_SINGULAR' ? 'has_inverse' : 'no_inverse',
        };
        const spec = remediationScene(item, answer, { id });
        if (spec.template !== 'grid_transform') throw new Error('wrong template');
        expect(spec.params.mode).toBe(mode);
        expect(spec.params.shown[0].value).toHaveLength(2);
        expect(det2(spec.params.shown[0].value).isZero()).toBe(id === 'M18_INV_SINGULAR');
        expect(spec.captions.unit).toBe(th.scenes.grid.example);
      }
    }
  });

  it('M18 and M19 on a 2×2 use the student’s own matrix', () => {
    const item = generate({
      skill: 'invertible',
      difficulty: 2,
      seed: 3,
      target: 'M19_INV_ZERO_ENTRY',
    });
    const spec = remediationScene(
      item,
      { kind: 'choice', id: 'no_inverse' },
      { id: 'M19_INV_ZERO_ENTRY' },
    );
    if (spec.template !== 'grid_transform' || item.data.form !== 'invertible')
      throw new Error('wrong');
    expect(spec.params.shown[0].value).toEqual(item.data.A);
  });

  it('M11 on a choice item composes a small pair that really differs by order', () => {
    for (const difficulty of [1, 3] as const) {
      for (const seed of SEEDS) {
        const item = generate({
          skill: 'mult_noncomm',
          difficulty,
          seed,
          target: 'M11_MULT_COMMUTATIVE',
        });
        const answer: Answer = item.diagnostics[0].answer as Answer;
        const spec = remediationScene(item, answer, { id: 'M11_MULT_COMMUTATIVE' });
        if (spec.template !== 'grid_transform') throw new Error('wrong template');
        expect(spec.params.mode).toBe('compose');
        const [left, right] = spec.params.frames.second!;
        expect(equals(left, right)).toBe(false);
        expect(spec.params.bounds.maxX - spec.params.bounds.minX).toBeLessThanOrEqual(8);
      }
    }
  });

  it('M20 flags the beat of the variant it caught and shows the student’s matrix', () => {
    const item = generate({
      skill: 'inv2',
      difficulty: 2,
      seed: 11,
      target: 'M20_INV2_RECIPE',
      targetVariant: 'NO_DIVIDE',
    });
    const answer = item.diagnostics[0].answer as Answer;
    const spec = remediationScene(item, answer, { id: 'M20_INV2_RECIPE', variant: 'NO_DIVIDE' });
    if (spec.template !== 'inverse_recipe' || answer.kind !== 'matrix') throw new Error('wrong');
    expect(spec.flagged).toBe('divide');
    expect(spec.params.student).toEqual(answer.value);
    expect(spec.compare?.variant).toBe('NO_DIVIDE');
  });

  it('M21 points at the first beat', () => {
    const item = generate({ skill: 'inv2', difficulty: 1, seed: 11, target: 'M21_INV_RECIPROCAL' });
    const answer = item.diagnostics[0].answer as Answer;
    const spec = remediationScene(item, answer, { id: 'M21_INV_RECIPROCAL' });
    if (spec.template !== 'inverse_recipe') throw new Error('wrong template');
    expect(spec.flagged).toBe('show');
    expect(spec.captions.show).toBe('อินเวอร์สไม่ใช่การกลับเศษทีละตัว');
  });

  it('falls back to worked_solution where the Tier B template does not exist yet', () => {
    for (const combo of COMBOS.filter(({ id }) =>
      [
        'M02_INDEX_SWAP',
        'M03_TRANSPOSE_WRONG',
        'M12_DET2_FORMULA',
        'M13_DET3_SIGN',
        'M05_SUB_REVERSED',
        'M15_DET_ADDITIVE',
        'M07_SCALAR_PARTIAL',
      ].includes(id),
    )) {
      const caught = caughtScene(combo, 17);
      expect(caught?.spec.template).toBe('worked_solution');
    }
  });

  it('lights up every cell for M07 (MISCONCEPTIONS §3)', () => {
    const item = assemble('scalar', 1, {
      form: 'scalar',
      k: 3,
      A: matrix([
        [1, -2],
        [5, 4],
      ]),
    });
    const spec = remediationScene(
      item,
      {
        kind: 'matrix',
        value: matrix([
          [3, -6],
          [5, 4],
        ]),
      },
      { id: 'M07_SCALAR_PARTIAL', variant: 'FIRST_ROW' },
    );
    if (spec.template !== 'worked_solution') throw new Error('wrong template');
    expect(spec.params.allCells?.k).toBe('3');
    expect(spec.params.allCells?.result).toEqual(
      matrix([
        [3, -6],
        [15, 12],
      ]),
    );
  });

  it('records the same specs as when these were checked', async () => {
    const lines = COMBOS.flatMap((combo) => {
      const caught = caughtScene(combo, 20261113);
      return caught
        ? [`${combo.id}:${combo.variant ?? ''}:L${combo.level} ${JSON.stringify(caught.spec)}`]
        : [];
    });
    await expect(`${lines.join('\n')}\n`).toMatchFileSnapshot('./__snapshots__/scene-specs.snap');
  });
});

describe('every ★ skill has a concept scene', () => {
  const skillLevels = SKILLS.flatMap(({ id }) => levelsOf(id).map((level) => ({ id, level })));

  it.each(skillLevels)('$id at L$level plays within 20 seconds', ({ id, level }) => {
    for (const seed of SEEDS) {
      const spec = conceptScene(id, { seed, level });
      expect(spec.purpose).toBe('concept');
      expectPlayable(spec);
      expect(sceneDurationMs(spec)).toBeLessThanOrEqual(20000);
    }
  });

  it('uses the template of SCENES §5.1, with worked_solution until Tier B exists', () => {
    const expected = {
      dim: 'dimension_match',
      index: 'worked_solution',
      transpose: 'worked_solution',
      addsub: 'dimension_match',
      scalar: 'worked_solution',
      mult_defined: 'dimension_match',
      mult: 'row_col_dot',
      mult_noncomm: 'grid_transform',
      det2: 'worked_solution',
      det3: 'worked_solution',
      det_props: 'grid_transform',
      invertible: 'grid_transform',
      inv2: 'inverse_recipe',
    } as const;
    for (const { id } of SKILLS) {
      expect(conceptScene(id, { seed: 1 }).template).toBe(expected[id]);
    }
  });

  it('plays the modes of SCENES §5.1, with no compare beat', () => {
    const dimension = (id: 'dim' | 'addsub' | 'mult_defined') => {
      const spec = conceptScene(id, { seed: 1 });
      if (spec.template !== 'dimension_match') throw new Error('wrong template');
      return spec.params.op;
    };
    expect(dimension('dim')).toBe('single');
    expect(dimension('addsub')).toBe('add');
    expect(dimension('mult_defined')).toBe('mult');

    const grid = (id: 'mult_noncomm' | 'det_props' | 'invertible') => {
      const spec = conceptScene(id, { seed: 1 });
      if (spec.template !== 'grid_transform') throw new Error('wrong template');
      return spec.params.mode;
    };
    expect(grid('mult_noncomm')).toBe('compose');
    expect(grid('det_props')).toBe('scale_k');
    expect(grid('invertible')).toBe('det_zero');

    expect((conceptScene('mult', { seed: 1 }).beats as string[]).includes('compare')).toBe(false);
    expect(conceptScene('inv2', { seed: 1 }).flagged).toBeUndefined();
    const scalarScene = conceptScene('scalar', { seed: 1 });
    if (scalarScene.template !== 'worked_solution') throw new Error('wrong template');
    expect(scalarScene.params.allCells).toBeDefined();
  });

  it('never shows the item being worked on, and never its answer', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...skillLevels),
        fc.integer({ min: 0, max: 0xffffffff }),
        fc.integer({ min: 0, max: 40 }),
        ({ id, level }, seed, nth) => {
          const open = generate({ skill: id, difficulty: level, seed });
          const options = {
            seed: exampleSeed(seed, nth),
            level,
            avoid: open,
            purpose: 'request' as const,
          };
          const example = conceptExample(id, options);
          if (example) {
            expect(JSON.stringify(example.data)).not.toBe(JSON.stringify(open.data));
            if (open.kind !== 'choice') {
              expect(answersEqual(example.correct, open.correct)).toBe(false);
            }
          }
          const spec = conceptScene(id, options);
          expect(spec.purpose).toBe('request');
          if (spec.template === 'grid_transform' && spec.params.mode === 'compose') {
            const drawn = [...spec.params.frames.first!, ...spec.params.frames.second!];
            const given =
              'A' in open.data && 'B' in open.data ? [open.data.A, open.data.B] : ([] as Matrix[]);
            const answer = open.correct.kind === 'matrix' ? [open.correct.value] : [];
            for (const value of [...given, ...answer]) {
              expect(drawn.some((frame) => equals(frame, value))).toBe(false);
            }
          }
        },
      ),
    );
  });

  it('gives a new example on each press', () => {
    const first = conceptScene('mult', { seed: exampleSeed(99, 0) });
    const second = conceptScene('mult', { seed: exampleSeed(99, 1) });
    expect(JSON.stringify(first)).not.toBe(JSON.stringify(second));
  });

  it('is deterministic', () => {
    for (const { id } of SKILLS) {
      expect(JSON.stringify(conceptScene(id, { seed: 7 }))).toBe(
        JSON.stringify(conceptScene(id, { seed: 7 })),
      );
    }
  });

  it('inv2 teaches on an example where dividing by det can be seen', () => {
    for (const seed of SEEDS) {
      const spec = conceptScene('inv2', { seed, level: 1 });
      if (spec.template !== 'inverse_recipe') throw new Error('wrong template');
      expect(spec.params.det.abs().compare(Rational.of(2))).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('unit intros', () => {
  it.each([1, 2, 3, 4, 5] as const)('unit %i plays within 40 seconds', (unit) => {
    const spec = introScene(unit);
    expect(spec.purpose).toBe('intro');
    expectPlayable(spec);
    expect(sceneDurationMs(spec)).toBeLessThanOrEqual(40000);
  });

  it('use the templates of SCENES §5', () => {
    expect(introScene(1).template).toBe('dimension_match');
    expect(introScene(2).template).toBe('worked_solution');
    expect(introScene(3).template).toBe('row_col_dot');
    const four = introScene(4);
    const five = introScene(5);
    if (four.template !== 'grid_transform' || five.template !== 'grid_transform') {
      throw new Error('wrong template');
    }
    expect(four.params.mode).toBe('det_area');
    expect(five.params.mode).toBe('undo');
  });

  it('unit 1 labels shops and products', () => {
    const spec = introScene(1);
    if (spec.template !== 'dimension_match') throw new Error('wrong template');
    expect(spec.params.labels?.rows).toHaveLength(spec.params.first.rows);
    expect(spec.params.labels?.cols).toHaveLength(spec.params.first.cols);
    expect(spec.params.values).toHaveLength(spec.params.first.rows);
  });

  it('unit 3 multiplies quantity by price with the engine', () => {
    const spec = introScene(3);
    if (spec.template !== 'row_col_dot') throw new Error('wrong template');
    const { left, right, product, names } = spec.params;
    expect(equals(mul(left, right), product)).toBe(true);
    expect(names).toEqual({ left: 'จำนวน', right: 'ราคา', result: 'รายได้' });
  });

  it('unit 2 and every worked step render in KaTeX', () => {
    const scenes = [
      introScene(2),
      ...SKILLS.map(({ id }) => conceptScene(id, { seed: 3 })),
      revealScene(generate({ skill: 'inv2', difficulty: 3, seed: 2 })),
    ];
    for (const spec of scenes) {
      if (spec.template !== 'worked_solution') continue;
      for (const step of spec.params.steps) {
        expect(() => katex.renderToString(step.latex, { throwOnError: true })).not.toThrow();
        expect(step.text).not.toMatch(/[{}]/);
      }
    }
  });
});

describe('worked_solution as a scene', () => {
  const allItems = SKILLS.flatMap(({ id }) =>
    levelsOf(id).flatMap((difficulty) =>
      SEEDS.map((seed) => generate({ skill: id, difficulty, seed })),
    ),
  );

  it('opens on every item in at most six taps, within its limit', () => {
    for (const item of allItems) {
      const spec = revealScene(item);
      expect(spec.purpose).toBe('reveal');
      expect(spec.beats.length).toBeLessThanOrEqual(6);
      expectPlayable(spec);
    }
  });

  it('gets to the end of the solution, each step in a beat that plays', () => {
    for (const item of allItems) {
      const spec = revealScene(item);
      if (spec.template !== 'worked_solution') throw new Error('wrong template');
      for (const step of spec.params.steps) expect(spec.beats).toContain(step.beat);
      expect(spec.params.steps.at(-1)?.beat).toBe(spec.beats.at(-1));
    }
  });
});

describe('scene copy', () => {
  it('unmarked wording is what docs/SCENES.md says', () => {
    const doc = readFileSync(new URL('../../../../docs/SCENES.md', import.meta.url), 'utf8');
    const source = readFileSync(new URL('../../../content/th.ts', import.meta.url), 'utf8');
    const start = source.indexOf('\n  scenes: {');
    const end = source.indexOf('\n  },', start);
    const lines = source.slice(start, end).split('\n');
    lines.forEach((line, index) => {
      const quoted = /^\s+\w+:\s*'(.*)',?$/.exec(line);
      if (!quoted || lines[index - 1].trim() === '// TODO(review)') return;
      expect(doc).toContain(quoted[1]);
    });
  });
});
