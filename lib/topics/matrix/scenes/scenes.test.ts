import fc from 'fast-check';
import katex from 'katex';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { cellByCellScene } from './cellByCell';
import { detSumScene } from './detSum';
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
import { cellLocatorScene } from './cellLocator';
import { dimensionScene } from './dimensionMatch';
import { gridScene } from './gridTransform';
import { inverseScene } from './inverseRecipe';
import { billOf, rowColDotScene } from './rowColDot';
import { sarrusScene } from './sarrus';
import { transposeScene } from './transposeFlip';
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
const SEEDS_TO_SEARCH = Array.from({ length: 2000 }, (_, i) => i);

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
      expect(caption).not.toMatch(/[{}]/);
      const lines = caption.replace(TONE_MARK, '$1').split('\n');
      expect(lines.length).toBeLessThanOrEqual(2);
      for (const line of lines) {
        expect(spacingLength(line)).toBeLessThanOrEqual(MAX_CAPTION_SPACING);
      }
    }
  }
  for (const beat of scene.waits ?? []) expect(scene.hints?.[beat]?.caption).toBeTruthy();
  if (scene.flagged) expect(scene.beats).toContain(scene.flagged);
  expect(sceneDurationMs(spec)).toBeLessThanOrEqual(sceneLimitMs(spec.purpose));
}

// Thai vowels above and below the line and tone marks take no width of their own. 360px leaves 328px
// at 16px, and the widest caption that fit in the browser has 42 of these. It is a guard for later
// edits; the real measurement is in the browser, recorded in docs/DECISIONS.md.
const THAI_MARKS = /[ัิ-ฺ็-๎]/g;
const spacingLength = (text: string) => text.replace(THAI_MARKS, '').length;
const MAX_CAPTION_SPACING = 44;
/** Words in a caption that wear the colour of what they name, as [r:this]. */
const TONE_MARK = /\[[rcw]:([^\]]*)\]/g;

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

describe('cell_locator on the example of MISCONCEPTIONS §3 (M02)', () => {
  const asked = matrix([
    [5, 8, 1],
    [2, 7, 4],
    [9, 3, 6],
  ]);

  it('a₂₃ is 4, and reading it the other way round gives a₃₂ = 3', () => {
    const { params, beats, captions } = cellLocatorScene({
      A: asked,
      i: 2,
      j: 3,
      showSwapped: true,
      purpose: 'remediate',
    });
    expect(params.value.equals(Rational.of(4))).toBe(true);
    expect(params.name).toBe('a₂₃');
    expect(params.swapped?.value.equals(Rational.of(3))).toBe(true);
    expect(params.swapped?.name).toBe('a₃₂');
    expect(beats).toEqual(['compare', 'row', 'col', 'hit', 'try', 'try_done']);
    expect(captions.row).toBe('แถวที่ 2 คือแนวนอน');
    expect(captions.col).toBe('หลักที่ 3 คือแนวตั้ง');
    expect(captions.compare).toContain('a₃₂');
  });

  it('has no compare beat when nothing is being compared', () => {
    const { params, beats } = cellLocatorScene({ A: asked, i: 2, j: 3, purpose: 'concept' });
    expect(beats).toEqual(['row', 'col', 'hit']);
    expect(params.swapped).toBeUndefined();
  });
});

describe('transpose_flip on the example of MISCONCEPTIONS §3 (M03)', () => {
  const wide = matrix([
    [1, 2, 3],
    [4, 5, 6],
  ]);

  it('turns each row into a column: one beat per row', () => {
    const { params, beats, captions } = transposeScene({ A: wide, purpose: 'concept' });
    expect(params.transposed).toEqual(
      matrix([
        [1, 4],
        [2, 5],
        [3, 6],
      ]),
    );
    expect(beats).toEqual(['setup', 'row_1', 'row_2', 'done']);
    expect(captions.row_2).toBe('แถวที่ 2 กลายเป็นหลักที่ 2');
  });

  it.each([
    ['ROT_CW', 'หมุน ≠ สะท้อนตามเส้นทแยง'],
    ['ROT_CCW', 'หมุน ≠ สะท้อนตามเส้นทแยง'],
    ['ANTI', 'เส้นทแยงรอง ≠ เส้นทแยงหลัก'],
    ['FLIP_H', 'พลิก ≠ สะท้อนตามเส้นทแยง'],
    ['FLIP_V', 'พลิก ≠ สะท้อนตามเส้นทแยง'],
    ['SAME', 'ยังไม่ได้เปลี่ยนแถวเป็นหลัก'],
  ] as const)('%s opens with what the student did', (variant, caption) => {
    const student = matrix([
      [4, 1],
      [5, 2],
      [6, 3],
    ]);
    const { params, beats, captions } = transposeScene({
      A: wide,
      variant,
      student,
      purpose: 'remediate',
    });
    expect(beats[0]).toBe('compare');
    expect(captions.compare).toBe(caption);
    expect(params.student).toEqual(student);
  });
});

describe('sarrus on the examples of MISCONCEPTIONS §3', () => {
  const big = matrix([
    [2, 1, 3],
    [0, -1, 4],
    [1, 2, 1],
  ]);

  it('M13: det = (−2 + 4 + 0) − (−3 + 16 + 0) = −11', () => {
    const { params, beats } = sarrusScene({ A: big, purpose: 'concept' });
    expect(params.size).toBe(3);
    expect(params.down.map(String)).toEqual(['-2', '4', '0']);
    expect(params.up.map(String)).toEqual(['-3', '16', '0']);
    expect(params.downSum.equals(Rational.of(2))).toBe(true);
    expect(params.upSum.equals(Rational.of(13))).toBe(true);
    expect(params.det.equals(Rational.of(-11))).toBe(true);
    expect(beats).toEqual(['copy', 'down', 'up', 'result']);
  });

  it.each([
    ['ALL_PLUS', 15, '−2 + 4 + 0 + (−3) + 16 + 0 = 15', 'เส้นขึ้นต้องลบ ไม่ใช่บวก'],
    ['NO_ALT_SIGN', -19, '2·(−9) + 1·(−4) + 3·1 = −19', 'แถวแรกต้องสลับเครื่องหมาย + − +'],
    ['TWO_DIAG', 1, '−2 − (−3) = 1', 'ต้องครบ 6 เส้น'],
  ] as const)('M13 %s gives %i', (variant, value, expression, caption) => {
    const { params, beats, captions } = sarrusScene({ A: big, variant, purpose: 'remediate' });
    expect(params.wrong?.value.equals(Rational.of(value))).toBe(true);
    expect(params.wrong?.expression).toBe(expression);
    expect(captions.compare).toBe(caption);
    expect(beats).toEqual(['copy', 'compare', 'down', 'try', 'up', 'result']);
  });

  it('M12: det = 2·4 − 1·3 = 5, with no column to copy', () => {
    const { params, beats } = sarrusScene({ A, purpose: 'concept' });
    expect(params.size).toBe(2);
    expect(params.down.map(String)).toEqual(['8']);
    expect(params.up.map(String)).toEqual(['3']);
    expect(params.det.equals(Rational.of(5))).toBe(true);
    expect(beats).toEqual(['down', 'up', 'result']);
  });

  it.each([
    ['ADD', 11, '2·4 + 1·3 = 11'],
    ['REVERSE', -5, '1·3 − 2·4 = −5'],
    ['PAIRS_ROW', -10, '2·1 − 3·4 = −10'],
    ['PAIRS_COL', 2, '2·3 − 1·4 = 2'],
  ] as const)('M12 %s gives %i', (variant, value, expression) => {
    const { params, beats } = sarrusScene({ A, variant, purpose: 'remediate' });
    expect(params.wrong?.value.equals(Rational.of(value))).toBe(true);
    expect(params.wrong?.expression).toBe(expression);
    expect(beats).toEqual(['compare', 'down', 'try', 'up', 'result']);
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

  it('plays the template the catalog names for each misconception (MISCONCEPTIONS §3)', () => {
    const expected = {
      M01_DIM_SWAP: 'dimension_match',
      M02_INDEX_SWAP: 'cell_locator',
      M03_TRANSPOSE_WRONG: 'transpose_flip',
      M04_ADD_DIM_MISMATCH: 'dimension_match',
      M05_SUB_REVERSED: 'cell_by_cell',
      M07_SCALAR_PARTIAL: 'cell_by_cell',
      M08_MULT_DIM_RULE: 'dimension_match',
      M09_MULT_ELEMENTWISE: 'row_col_dot',
      M10_MULT_ROW_ROW: 'row_col_dot',
      M12_DET2_FORMULA: 'sarrus',
      M13_DET3_SIGN: 'sarrus',
      M14_DET_SCALAR_LINEAR: 'grid_transform',
      M15_DET_ADDITIVE: 'det_sum',
      M18_INV_SINGULAR: 'grid_transform',
      M19_INV_ZERO_ENTRY: 'grid_transform',
      M20_INV2_RECIPE: 'inverse_recipe',
      M21_INV_RECIPROCAL: 'inverse_recipe',
    } as const;
    for (const combo of COMBOS) {
      if (combo.id === 'M11_MULT_COMMUTATIVE') continue;
      expect(caughtScene(combo, 17)?.spec.template).toBe(expected[combo.id]);
    }
  });

  it('M02 points at the cell the student read, and that cell is what they answered', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<Level>(1, 2, 3),
        fc.integer({ min: 0, max: 0xffffffff }),
        (level, seed) => {
          const caught = caughtScene({ id: 'M02_INDEX_SWAP', skill: 'index', level }, seed);
          if (!caught || caught.spec.template !== 'cell_locator') throw new Error('wrong template');
          if (caught.item.data.form !== 'index' || caught.answer.kind !== 'scalar') {
            throw new Error('wrong form');
          }
          const { params, beats } = caught.spec;
          const { A: asked, i, j } = caught.item.data;
          expect(params.value.equals(asked[i - 1][j - 1])).toBe(true);
          expect(params.swapped?.value.equals(caught.answer.value)).toBe(true);
          expect(beats[0]).toBe('compare');
          expect(beats.at(-1)).toBe('try_done');
        },
      ),
    );
  });

  it('M03 builds the true transpose, and shows what the student typed beside it', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...COMBOS.filter(({ id }) => id === 'M03_TRANSPOSE_WRONG')),
        fc.integer({ min: 0, max: 0xffffffff }),
        (combo, seed) => {
          const caught = caughtScene(combo, seed);
          if (!caught) return;
          if (caught.spec.template !== 'transpose_flip') throw new Error('wrong template');
          const { params, beats, compare } = caught.spec;
          if (caught.item.correct.kind !== 'matrix' || caught.answer.kind !== 'matrix') {
            throw new Error('wrong answer kind');
          }
          expect(equals(params.transposed, caught.item.correct.value)).toBe(true);
          expect(equals(params.student!, caught.answer.value)).toBe(true);
          expect(beats[0]).toBe('compare');
          expect(compare?.variant).toBe(combo.variant);
          expect(beats.filter((beat) => beat.startsWith('row_'))).toHaveLength(params.A.length);
        },
      ),
    );
  });

  it('M12 and M13 work out det, and the wrong value is what the student typed', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          ...COMBOS.filter(({ id }) => id === 'M12_DET2_FORMULA' || id === 'M13_DET3_SIGN'),
        ),
        fc.integer({ min: 0, max: 0xffffffff }),
        (combo, seed) => {
          const caught = caughtScene(combo, seed);
          if (!caught) return;
          if (caught.spec.template !== 'sarrus') throw new Error('wrong template');
          const { params, compare } = caught.spec;
          if (caught.item.correct.kind !== 'scalar' || caught.answer.kind !== 'scalar') {
            throw new Error('wrong answer kind');
          }
          expect(params.det.equals(caught.item.correct.value)).toBe(true);
          expect(params.wrong?.value.equals(caught.answer.value)).toBe(true);
          expect(params.downSum.sub(params.upSum).equals(params.det)).toBe(true);
          expect(compare?.variant).toBe(combo.variant);
        },
      ),
    );
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
    if (spec.template !== 'cell_by_cell') throw new Error('wrong template');
    expect(String(spec.params.k)).toBe('3');
    expect(spec.params.result).toEqual(
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

  it.each(skillLevels)('$id at L$level plays within its limit', ({ id, level }) => {
    for (const seed of SEEDS) {
      const spec = conceptScene(id, { seed, level });
      expect(spec.purpose).toBe('concept');
      expectPlayable(spec);
      expect(sceneDurationMs(spec)).toBeLessThanOrEqual(sceneLimitMs('concept'));
    }
  });

  it('uses the template of SCENES §5.1', () => {
    const expected = {
      dim: 'dimension_match',
      index: 'cell_locator',
      transpose: 'transpose_flip',
      addsub: 'cell_by_cell',
      scalar: 'cell_by_cell',
      mult_defined: 'dimension_match',
      mult: 'row_col_dot',
      mult_noncomm: 'grid_transform',
      det2: 'sarrus',
      det3: 'sarrus',
      det_props: 'grid_transform',
      invertible: 'grid_transform',
      inv2: 'inverse_recipe',
    } as const;
    for (const { id } of SKILLS) {
      expect(conceptScene(id, { seed: 1 }).template).toBe(expected[id]);
    }
  });

  it('plays the modes of SCENES §5.1, with no compare beat', () => {
    const dimension = (id: 'dim' | 'mult_defined') => {
      const spec = conceptScene(id, { seed: 1 });
      if (spec.template !== 'dimension_match') throw new Error('wrong template');
      return spec.params.op;
    };
    expect(dimension('dim')).toBe('single');
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
    if (scalarScene.template !== 'cell_by_cell') throw new Error('wrong template');
    expect(scalarScene.params.work).toHaveLength(scalarScene.params.left.flat().length);
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

describe('concept examples can show what their scene is about', () => {
  const live = (values: Rational[]) => values.filter((value) => !value.isZero()).length;
  const seedArb = fc.integer({ min: 0, max: 0xffffffff });
  const levels = fc.constantFrom<Level>(1, 2, 3);

  it('mult: the highlighted pairs never all multiply to zero', () => {
    fc.assert(
      fc.property(seedArb, levels, (seed, level) => {
        const spec = conceptScene('mult', { seed, level });
        if (spec.template !== 'row_col_dot') throw new Error('wrong template');
        expect(live(spec.params.terms.map(({ product }) => product))).toBeGreaterThan(0);
      }),
    );
  });

  it('index: asks for a cell off the diagonal, where (i, j) and (j, i) differ', () => {
    fc.assert(
      fc.property(seedArb, levels, (seed, level) => {
        const spec = conceptScene('index', { seed, level });
        if (spec.template !== 'cell_locator') throw new Error('wrong template');
        expect(spec.params.i).not.toBe(spec.params.j);
      }),
    );
  });

  it('transpose: never a symmetric matrix, which would not change at all', () => {
    fc.assert(
      fc.property(seedArb, levels, (seed, level) => {
        const spec = conceptScene('transpose', { seed, level });
        if (spec.template !== 'transpose_flip') throw new Error('wrong template');
        expect(equals(spec.params.A, spec.params.transposed)).toBe(false);
      }),
    );
  });

  it('det2: both lines have something to show', () => {
    fc.assert(
      fc.property(seedArb, fc.constantFrom<Level>(1, 2), (seed, level) => {
        const spec = conceptScene('det2', { seed, level });
        if (spec.template !== 'sarrus') throw new Error('wrong template');
        expect(live([...spec.params.down, ...spec.params.up])).toBe(2);
      }),
    );
  });

  it('det3: at least three lines are not zero, with at least one each way', () => {
    fc.assert(
      fc.property(seedArb, levels, (seed, level) => {
        const spec = conceptScene('det3', { seed, level });
        if (spec.template !== 'sarrus') throw new Error('wrong template');
        const { down, up } = spec.params;
        expect(live(down)).toBeGreaterThan(0);
        expect(live(up)).toBeGreaterThan(0);
        expect(live(down) + live(up)).toBeGreaterThanOrEqual(3);
      }),
    );
  });

  it('det_props: k changes the size, so k² can be seen', () => {
    fc.assert(
      fc.property(seedArb, (seed) => {
        const example = conceptExample('det_props', { seed });
        if (example?.data.form !== 'det_scaled') throw new Error('wrong form');
        expect(Math.abs(example.data.k)).toBeGreaterThanOrEqual(2);
      }),
    );
  });

  it.each([
    [
      'mult',
      1,
      ({ data }: ReturnType<typeof generate>) =>
        data.form === 'mult' && data.A[0].every((cell, k) => cell.mul(data.B[k][0]).isZero()),
    ],
    [
      'det_props',
      1,
      ({ data }: ReturnType<typeof generate>) =>
        data.form === 'det_scaled' && Math.abs(data.k) === 1,
    ],
  ] as const)('%s really does pass over a weak draw', (skill, level, isWeak) => {
    // The first draw for this seed is weak, so reaching a different one proves the filter ran.
    const seed = SEEDS_TO_SEARCH.find((candidate) =>
      isWeak(generate({ skill, difficulty: level, seed: exampleSeed(candidate, 0) })),
    );
    expect(seed).toBeDefined();
    const example = conceptExample(skill, { seed: seed!, level })!;
    expect(isWeak(example)).toBe(false);
    expect(example.ref.seed).not.toBe(exampleSeed(seed!, 0));
  });
});

describe('unit intros', () => {
  it.each([1, 2, 3, 4, 5] as const)('unit %i plays within 40 seconds', (unit) => {
    const spec = introScene(unit);
    expect(spec.purpose).toBe('intro');
    expectPlayable(spec);
    expect(sceneDurationMs(spec)).toBeLessThanOrEqual(40000);
  });

  it('give each student their own numbers and their own story', () => {
    const numbersOf = (spec: unknown) => JSON.stringify((spec as { params: unknown }).params);
    const first = introScene(3, { seed: 1, theme: 'game' });
    expect(numbersOf(introScene(3, { seed: 1, theme: 'game' }))).toBe(numbersOf(first));
    expect(numbersOf(introScene(3, { seed: 2, theme: 'game' }))).not.toBe(numbersOf(first));
    const seen = new Set(
      Array.from({ length: 40 }, (_, seed) => numbersOf(introScene(1, { seed, theme: 'shop' }))),
    );
    expect(seen.size).toBeGreaterThan(35);
    const stories = (['shop', 'game', 'sport', 'music', 'food'] as const).map(
      (theme) => introScene(1, { seed: 1, theme }).captions,
    );
    expect(new Set(stories.map((captions) => JSON.stringify(captions))).size).toBe(5);
  });

  it('work out every intro of every student from the engine, within the time limit', () => {
    for (let seed = 0; seed < 60; seed += 1) {
      for (const unit of [1, 2, 3, 4, 5] as const) {
        for (const theme of ['shop', 'game', 'sport', 'music', 'food'] as const) {
          const spec = introScene(unit, { seed, theme });
          expect(sceneDurationMs(spec)).toBeLessThanOrEqual(sceneLimitMs('intro'));
          for (const beat of spec.beats as string[]) {
            const caption = (spec.captions as Record<string, string | undefined>)[beat];
            if (spec.template !== 'worked_solution')
              expect(caption, `${unit} ${beat}`).toBeTruthy();
            expect(caption ?? '').not.toContain('{{');
          }
        }
      }
    }
  });

  it('use the templates of SCENES §5', () => {
    expect(introScene(1).template).toBe('dimension_match');
    expect(introScene(2).template).toBe('cell_by_cell');
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

  it('no intro can be the first item of its unit, whatever the seed (SPEC §4)', () => {
    const givenIn = (spec: SceneSpec): Matrix[] => {
      if (spec.template === 'grid_transform') return spec.params.shown.map(({ value }) => value);
      if (spec.template === 'dimension_match')
        return spec.params.values ? [spec.params.values] : [];
      return [];
    };
    const firstSkill = { 1: 'dim', 4: 'det2', 5: 'invertible' } as const;
    for (const unit of [1, 4, 5] as const) {
      const shown = givenIn(introScene(unit));
      expect(shown.length).toBeGreaterThan(0);
      for (const seed of SEEDS_TO_SEARCH) {
        const { data } = generate({ skill: firstSkill[unit], difficulty: 1, seed });
        if (!('A' in data)) throw new Error('wrong form');
        for (const value of shown) expect(equals(value, data.A)).toBe(false);
      }
    }
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

describe('cell_by_cell', () => {
  const A = matrix([
    [3, -2],
    [5, 4],
  ]);
  const B = matrix([
    [1, -6],
    [0, 7],
  ]);

  it('works out each cell with the engine, brackets around a negative term', () => {
    const spec = cellByCellScene({ op: 'sub', left: A, right: B, purpose: 'concept' });
    expect(spec.params.result).toEqual(
      matrix([
        [2, 4],
        [5, -3],
      ]),
    );
    expect(spec.params.work[1].expression).toBe('−2 − (−6) = 4');
  });

  it('scales every cell', () => {
    const spec = cellByCellScene({ op: 'scalar', left: A, k: Rational.of(-3), purpose: 'concept' });
    expect(spec.params.work).toHaveLength(4);
    expect(spec.params.work[1].expression).toBe('(−3) × (−2) = 6');
  });

  it('starts from the cell the student got wrong', () => {
    const spec = cellByCellScene({
      op: 'add',
      left: A,
      right: B,
      focus: [2, 2],
      variant: 'REVERSED',
      student: A,
      purpose: 'remediate',
    });
    expect([spec.params.work[0].i, spec.params.work[0].j]).toEqual([2, 2]);
    expect(spec.beats[0]).toBe('compare');
    expect(spec.flagged).toBe('compare');
  });

  it('has a caption for every beat, within the time limit', () => {
    const spec = cellByCellScene({ op: 'add', left: A, right: B, purpose: 'concept' });
    for (const beat of spec.beats) expect(spec.captions[beat]).toBeTruthy();
    expect(sceneDurationMs(spec)).toBeLessThanOrEqual(sceneLimitMs('concept'));
  });
});

describe('the bill a cell-by-cell answer gets', () => {
  const cellByCell = (left: Matrix, right: Matrix): Matrix =>
    left.map((cells, i) => cells.map((cell, j) => cell.mul(right[i][j])));
  const swords = matrix([
    [1, 2],
    [3, 4],
  ]);
  const prices = matrix([
    [5, 6],
    [7, 8],
  ]);

  it('is told on the first wrong cell of the diagonal, in the student’s own story', () => {
    const bill = billOf(swords, prices, cellByCell(swords, prices), 'game');
    expect(bill?.cell).toEqual([1, 1]);
    expect(bill?.story.who).toBe('ผู้เล่น ก');
    expect(bill?.story.items[0]).toBe('ดาบ');
  });

  it('will not count swords with a negative number, so it moves to a row that can be counted', () => {
    const left = matrix([
      [-1, 2],
      [3, 4],
    ]);
    expect(billOf(left, prices, cellByCell(left, prices), 'game')?.cell).toEqual([2, 2]);
  });

  it('is not told when no row can be counted, and the clip is the plain one', () => {
    const left = matrix([
      [-1, 2],
      [3, -4],
    ]);
    const student = cellByCell(left, prices);
    expect(billOf(left, prices, student, 'game')).toBeNull();
    const plain = rowColDotScene({
      left,
      right: prices,
      variant: 'elementwise',
      student,
      purpose: 'remediate',
    });
    expect(plain.params.story).toBeUndefined();
    expect(plain.beats).toContain('multiply');
    expect(plain.beats).not.toContain('only_first');
  });

  it('adds up, on every sampled seed: their one line is what they answered, and the total is right', () => {
    let told = 0;
    for (const seed of SEEDS_TO_SEARCH.slice(0, 400)) {
      const item = generate({
        skill: 'mult',
        difficulty: 1,
        seed,
        target: 'M09_MULT_ELEMENTWISE',
      });
      const wrong = item.diagnostics.find(({ id }) => id === 'M09_MULT_ELEMENTWISE');
      if (wrong?.answer.kind !== 'matrix') continue;
      const spec = remediationScene(item, wrong.answer, { id: 'M09_MULT_ELEMENTWISE' }, 'food');
      if (spec.template !== 'row_col_dot') throw new Error('wrong template');
      const { params, beats, captions } = spec;
      expectPlayable(spec);
      const [row, col] = [params.cell[0] - 1, params.cell[1] - 1];
      expect(sum(params.terms.map(({ product }) => product)).equals(params.product[row][col])).toBe(
        true,
      );
      if (!params.story) continue;
      told += 1;
      expect(row).toBe(col);
      expect(beats).toContain('only_first');
      expect(params.terms[row].product.equals(params.student![row][col])).toBe(true);
      expect(params.terms.every(({ a, b }) => a.sign() >= 0 && b.sign() >= 0)).toBe(true);
      expect(captions.pick_row).toContain(params.story.who);
    }
    expect(told).toBeGreaterThan(100);
  });

  it('asks for another cell than the one it worked out', () => {
    const spec = rowColDotScene({
      left: swords,
      right: prices,
      variant: 'elementwise',
      student: cellByCell(swords, prices),
      purpose: 'remediate',
    });
    expect(spec.params.tryCell).not.toEqual(spec.params.cell);
    expect(spec.waits).toEqual(['try_row', 'try_col']);
    expect(spec.hints?.try_row?.voice).toBe('bill.hint_row');
  });
});

describe('det_sum', () => {
  it('shows the two ways giving different answers, from the engine', () => {
    const spec = detSumScene({
      A: matrix([
        [2, 1],
        [1, 3],
      ]),
      B: matrix([
        [1, 2],
        [0, 1],
      ]),
      purpose: 'remediate',
    });
    expect(spec.params.sum).toEqual(
      matrix([
        [3, 3],
        [1, 4],
      ]),
    );
    expect(String(spec.params.wrong)).toBe('6');
    expect(String(spec.params.detSum)).toBe('9');
    expect(spec.params.rightLine).toBe('3 × 4 − 3 × 1 = 9');
    expect(sceneDurationMs(spec)).toBeLessThanOrEqual(sceneLimitMs('remediate'));
  });
});
