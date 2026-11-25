import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { classify } from '@/lib/core/classify';
import { Rational } from '@/lib/core/rational';
import { Surd } from '@/lib/core/surd';
import type { Answer, DiagnosticAnswer } from '@/lib/core/types';
import { assemble, generate } from './generators';
import { CATALOG, catalogEntry, isRightBox, probeLevels, variantsOf } from './misconceptions';
import { vec } from './ops';
import { validateVectorItem } from './rules';
import type { SkillId } from './skills';
import type { Figure, MisconceptionId, PointLabel, Term, VectorData, VectorItem } from './types';

// Every number in this file is copied from docs/VECTORS.md §4. If code disagrees, the code is wrong.

const s = (text: string) => Surd.parse(text);
const surd = (text: string): Answer => ({ kind: 'surd', value: s(text) });
const vector = (...parts: (string | number)[]): Answer => ({
  kind: 'vector',
  value: parts.map((part) => s(String(part))),
});
const scalar = (value: string | number): Answer => ({
  kind: 'scalar',
  value: Rational.parse(String(value)),
});
const choice = (id: string): Answer => ({ kind: 'choice', id });

function diagnosticAnswer(item: VectorItem, id: MisconceptionId): DiagnosticAnswer | undefined {
  return item.diagnostics.find((d) => d.id === id)?.answer;
}

function expectDetects(item: VectorItem, id: MisconceptionId, answer: Answer) {
  expect(diagnosticAnswer(item, id)).toEqual(answer);
  expect(classify(item, answer)).toEqual({ type: 'misconception', id });
}

function expectCorrect(item: VectorItem, answer: Answer) {
  expect(item.correct).toEqual(answer);
  expect(classify(item, answer)).toEqual({ type: 'correct' });
}

function expectValid(item: VectorItem) {
  expect(validateVectorItem(item)).toEqual({ ok: true });
}

const ids = (item: VectorItem) => item.diagnostics.map((d) => d.id);

/** The candidate a catalog entry gives for these numbers, whether or not the item could show it. */
function candidateOf(id: MisconceptionId, data: VectorData): DiagnosticAnswer | null {
  const spec = catalogEntry(id).variants.find((variant) => variant.applies({ data }));
  return spec ? spec.candidate({ data }) : null;
}

const one = (from: PointLabel, to: PointLabel): Term => ({ k: Rational.ONE, from, to });
const minus = (from: PointLabel, to: PointLabel): Term => ({ k: Rational.of(-1), from, to });

/** §4 V1: parallelogram A(0, 0) B(4, 0) C(5, 3) D(1, 3). */
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

describe('V01_QUANTITY_MIX', () => {
  it('"which is a vector quantity": velocity (correct), speed (V01), mass, temperature', () => {
    const item = assemble('v_quantity', 1, {
      form: 'quantity_kind',
      ask: 'vector',
      options: ['velocity', 'speed', 'mass', 'temperature'],
    });
    expectCorrect(item, choice('q_velocity'));
    expectDetects(item, 'V01_QUANTITY_MIX', choice('q_speed'));
    expect(classify(item, choice('q_mass'))).toEqual({ type: 'unknown' });
    expectValid(item);
  });

  it('works the other way round: distance is scalar, displacement is V01', () => {
    const item = assemble('v_quantity', 1, {
      form: 'quantity_kind',
      ask: 'scalar',
      options: ['displacement', 'distance', 'force', 'acceleration'],
    });
    expectCorrect(item, choice('q_distance'));
    expectDetects(item, 'V01_QUANTITY_MIX', choice('q_displacement'));
  });
});

describe('V02_EQUAL_IGNORES_DIRECTION', () => {
  it('ABCD: AB equals DC (correct) · CD (V02) · BC · AC', () => {
    const item = assemble('v_quantity', 2, {
      form: 'figure_equal',
      figure: ABCD,
      of: one('A', 'B'),
      negative: false,
      options: [one('D', 'C'), one('C', 'D'), one('B', 'C'), one('A', 'C')],
    });
    expectCorrect(item, choice('DC'));
    expectDetects(item, 'V02_EQUAL_IGNORES_DIRECTION', choice('CD'));
    expectValid(item);
  });

  it('for the negative of AB, CD is right and DC is V02', () => {
    const item = assemble('v_quantity', 2, {
      form: 'figure_equal',
      figure: ABCD,
      of: one('A', 'B'),
      negative: true,
      options: [one('D', 'C'), one('C', 'D'), one('B', 'C'), one('A', 'C')],
    });
    expectCorrect(item, choice('CD'));
    expectDetects(item, 'V02_EQUAL_IGNORES_DIRECTION', choice('DC'));
  });
});

describe('V03_GEOM_SUB_DIRECTION', () => {
  it('ABCD: AB − AD = DB (correct) · BD (V03)', () => {
    const item = assemble('v_geom', 2, {
      form: 'figure_expr',
      figure: ABCD,
      expr: [one('A', 'B'), minus('A', 'D')],
      options: [one('D', 'B'), one('B', 'D'), one('A', 'C'), one('B', 'C')],
    });
    expectCorrect(item, choice('DB'));
    expectDetects(item, 'V03_GEOM_SUB_DIRECTION', choice('BD'));
    expect(ids(item)).not.toContain('V04_GEOM_ADD_JOIN_TIPS');
    expectValid(item);
  });
});

describe('V04_GEOM_ADD_JOIN_TIPS', () => {
  it('ABCD: AB + AD = AC (correct, the diagonal) · BD (V04)', () => {
    const item = assemble('v_geom', 2, {
      form: 'figure_expr',
      figure: ABCD,
      expr: [one('A', 'B'), one('A', 'D')],
      options: [one('A', 'C'), one('B', 'D'), one('D', 'B'), one('B', 'C')],
    });
    expectCorrect(item, choice('AC'));
    expectDetects(item, 'V04_GEOM_ADD_JOIN_TIPS', choice('BD'));
    expect(ids(item)).not.toContain('V03_GEOM_SUB_DIRECTION');
    expectValid(item);
  });

  it('does not apply head to tail, where no two vectors share a tail', () => {
    const item = assemble('v_geom', 1, {
      form: 'figure_expr',
      figure: ABCD,
      expr: [one('A', 'B'), one('B', 'C')],
      options: [one('A', 'C'), one('C', 'A'), one('B', 'D'), one('D', 'B')],
    });
    expect(item.diagnostics).toEqual([]);
  });
});

describe('V05_POINTS_REVERSED', () => {
  it('A(1, −2, 3), B(4, 2, −1) → AB = (3, 4, −4) · candidate (−3, −4, 4)', () => {
    const item = assemble('v_points', 2, { form: 'points', A: vec(1, -2, 3), B: vec(4, 2, -1) });
    expectCorrect(item, vector(3, 4, -4));
    expectDetects(item, 'V05_POINTS_REVERSED', vector(-3, -4, 4));
    expectValid(item);
  });

  it('does not apply when AB has only one non-zero component', () => {
    const item = assemble('v_points', 2, { form: 'points', A: vec(1, -2, 3), B: vec(4, -2, 3) });
    expect(item.diagnostics).toEqual([]);
  });
});

describe('V06_SCALAR_PARTIAL and V07_COMBO_SIGN', () => {
  const item = assemble('v_linear', 2, {
    form: 'linear',
    terms: [
      { k: 3, name: 'u', vec: vec(2, -1, 3) },
      { k: -2, name: 'v', vec: vec(1, 4, -2) },
    ],
    notation: 'tuple',
  });

  it('u = (2, −1, 3), v = (1, 4, −2): 3u − 2v = (4, −11, 13)', () => {
    expectCorrect(item, vector(4, -11, 13));
    expectValid(item);
  });

  it('V06 candidate (4, −5, 5), two components away', () => {
    expectDetects(item, 'V06_SCALAR_PARTIAL', vector(4, -5, 5));
  });

  it('V07 candidate 3u + 2v = (8, 5, 5), three away and apart from V06', () => {
    expectDetects(item, 'V07_COMBO_SIGN', vector(8, 5, 5));
  });

  it('V06 on ku scales the first component only; V07 needs a minus', () => {
    const ku = assemble('v_linear', 1, {
      form: 'linear',
      terms: [{ k: 3, name: 'u', vec: vec(2, 1, 4) }],
      notation: 'tuple',
    });
    expectCorrect(ku, vector(6, 3, 12));
    expectDetects(ku, 'V06_SCALAR_PARTIAL', vector(6, 1, 4));
    expect(ids(ku)).not.toContain('V07_COMBO_SIGN');
  });

  it('V06 cannot show on a 2D ku, where it changes one component only', () => {
    expect(
      candidateOf('V06_SCALAR_PARTIAL', {
        form: 'linear',
        terms: [{ k: 3, name: 'u', vec: vec(2, 1) }],
        notation: 'tuple',
      }),
    ).toBeNull();
  });
});

describe('V08_PARALLEL_RATIO_FLIP', () => {
  it('u = (2, m, −4) ∥ v = (3, 6, −6) → m = 4 · candidate 2/3 = 6/m → m = 9', () => {
    const item = assemble('v_parallel', 2, {
      form: 'parallel',
      u: [Rational.of(2), 'm', Rational.of(-4)],
      v: [Rational.of(3), Rational.of(6), Rational.of(-6)],
      ask: 'm',
    });
    expectCorrect(item, scalar(4));
    expectDetects(item, 'V08_PARALLEL_RATIO_FLIP', scalar(9));
    expectValid(item);
  });
});

describe('V09_MAG_NO_ROOT and V10_MAG_SUM_COMPONENTS', () => {
  const item = assemble('v_magnitude', 2, { form: 'magnitude', v: vec(1, -4, 1) });

  it('v = (1, −4, 1) → |v| = √18 = 3√2', () => {
    expectCorrect(item, surd('3√2'));
    expectValid(item);
  });

  it('V09 candidate 18', () => expectDetects(item, 'V09_MAG_NO_ROOT', surd('18')));

  it('V10 candidate 6, apart from V09', () =>
    expectDetects(item, 'V10_MAG_SUM_COMPONENTS', surd('6')));

  it('V09 does not apply when |v| = 1, and V10 needs two non-zero components', () => {
    const unitLong = assemble('v_magnitude', 2, { form: 'magnitude', v: vec(0, -1, 0) });
    expect(unitLong.diagnostics).toEqual([]);
  });
});

describe('V11_MAG_ADDITIVE', () => {
  const data: VectorData = {
    form: 'magnitude_combo',
    terms: [
      { k: 1, name: 'u', vec: vec(2, 1, 2) },
      { k: 1, name: 'v', vec: vec(0, 4, 3) },
    ],
  };

  it('u = (2, 1, 2), v = (0, 4, 3) → u + v = (2, 5, 5), |u + v| = √54 = 3√6 · candidate 3 + 5 = 8', () => {
    const item = assemble('v_magnitude', 3, data);
    expectCorrect(item, surd('3√6'));
    expect(candidateOf('V11_MAG_ADDITIVE', data)).toEqual(surd('8'));
  });

  it('as an item, the doc example probes V11, apart from V09 = 54 and V10 = 12', () => {
    const item = assemble('v_magnitude', 3, data, { target: 'V11_MAG_ADDITIVE' });
    expectDetects(item, 'V11_MAG_ADDITIVE', surd('8'));
    expectDetects(item, 'V09_MAG_NO_ROOT', surd('54'));
    expectDetects(item, 'V10_MAG_SUM_COMPONENTS', surd('12'));
    expectValid(item);
  });

  // The example the doc had before: u + v = (3, 0, 3), and V10 gives |3| + |0| + |3| = 6 = |u| + |v|.
  const old: VectorData = {
    form: 'magnitude_combo',
    terms: [
      { k: 1, name: 'u', vec: vec(1, 2, 2) },
      { k: 1, name: 'v', vec: vec(2, -2, 1) },
    ],
  };

  it('the old example u = (1, 2, 2), v = (2, −2, 1) cannot probe V11: V10 gives 6 too', () => {
    const data = old;
    expect(candidateOf('V11_MAG_ADDITIVE', data)).toEqual(surd('6'));
    const item = assemble('v_magnitude', 3, data);
    expect(diagnosticAnswer(item, 'V10_MAG_SUM_COMPONENTS')).toEqual(surd('6'));
    expect(ids(item)).not.toContain('V11_MAG_ADDITIVE');
    const probe = assemble('v_magnitude', 3, data, { target: 'V11_MAG_ADDITIVE' });
    expect(validateVectorItem(probe)).toMatchObject({ ok: false, failure: { rule: 2 } });
  });

  it('does not apply when |u| + |v| is not one Surd, such as √2 + 1', () => {
    expect(
      candidateOf('V11_MAG_ADDITIVE', {
        form: 'magnitude_combo',
        terms: [
          { k: 1, name: 'u', vec: vec(1, 1, 0) },
          { k: 1, name: 'v', vec: vec(0, 0, 1) },
        ],
      }),
    ).toBeNull();
  });

  it('does not apply when u and v point the same way', () => {
    expect(
      candidateOf('V11_MAG_ADDITIVE', {
        form: 'magnitude_combo',
        terms: [
          { k: 1, name: 'u', vec: vec(1, 2, 2) },
          { k: 1, name: 'v', vec: vec(2, 4, 4) },
        ],
      }),
    ).toBeNull();
  });
});

describe('V12_UNIT_SQUARED and V13_UNIT_DIVIDE_SUM', () => {
  it('v = (1, 2, 2), |v| = 3 → (1/3, 2/3, 2/3) · V12 (1/9, 2/9, 2/9) · V13 (1/5, 2/5, 2/5)', () => {
    const item = assemble('v_unit', 2, { form: 'unit', v: vec(1, 2, 2) });
    expectCorrect(item, vector('1/3', '2/3', '2/3'));
    expectDetects(item, 'V12_UNIT_SQUARED', vector('1/9', '2/9', '2/9'));
    expectDetects(item, 'V13_UNIT_DIVIDE_SUM', vector('1/5', '2/5', '2/5'));
    expectValid(item);
  });

  it('L3: v = (1, −1, 2), |v| = √6 → (√6/6, −√6/6, √6/3) · V12 (1/6, −1/6, 1/3) · V13 (1/2, −1/2, 1)', () => {
    const item = assemble('v_unit', 3, { form: 'unit', v: vec(1, -1, 2) });
    expectCorrect(item, vector('1/6√6', '-1/6√6', '1/3√6'));
    expectDetects(item, 'V12_UNIT_SQUARED', vector('1/6', '-1/6', '1/3'));
    expectDetects(item, 'V13_UNIT_DIVIDE_SUM', vector('1/2', '-1/2', 1));
    expectValid(item);
  });

  it('V13 does not apply when the components add to 0', () => {
    const item = assemble('v_unit', 3, { form: 'unit', v: vec(1, -2, 1) });
    expect(ids(item)).not.toContain('V13_UNIT_DIVIDE_SUM');
  });
});

describe('V14_DOT_AS_DET', () => {
  it('u = (3, −2), v = (4, 5) → u·v = 12 − 10 = 2 · candidate 3·5 − (−2)·4 = 23', () => {
    const item = assemble('v_dot', 1, { form: 'dot', u: vec(3, -2), v: vec(4, 5) });
    expectCorrect(item, surd('2'));
    expectDetects(item, 'V14_DOT_AS_DET', surd('23'));
    expectValid(item);
  });

  it('only in 2D', () => {
    const item = assemble('v_dot', 2, { form: 'dot', u: vec(3, -2, 1), v: vec(4, 5, 1) });
    expect(item.diagnostics).toEqual([]);
  });
});

describe('V15_DOT_NO_COS and V16_DOT_SIN', () => {
  const polar = (theta: 0 | 45 | 60 | 135) =>
    assemble('v_dot', 3, { form: 'dot_polar', normU: s('4'), normV: s('6'), theta });

  it('|u| = 4, |v| = 6, θ = 60° → 24 · ½ = 12 · V15 24 · V16 12√3', () => {
    const item = polar(60);
    expectCorrect(item, surd('12'));
    expectDetects(item, 'V15_DOT_NO_COS', surd('24'));
    expectDetects(item, 'V16_DOT_SIN', surd('12√3'));
    expectValid(item);
  });

  it('θ = 135° → −12√2 · V16 12√2', () => {
    const item = polar(135);
    expectCorrect(item, surd('-12√2'));
    expectDetects(item, 'V16_DOT_SIN', surd('12√2'));
  });

  it('V16 never at 45°, where sin and cos agree (12√2 both)', () => {
    const item = polar(45);
    expectCorrect(item, surd('12√2'));
    expect(ids(item)).not.toContain('V16_DOT_SIN');
  });

  it('V15 never at 0°', () => {
    expect(ids(polar(0))).not.toContain('V15_DOT_NO_COS');
  });
});

describe('V17_ANGLE_ABS', () => {
  it('u = (1, 1, 0), v = (−1, 0, 1) → cos θ = −1/2, θ = 120° · candidate 60°', () => {
    const item = assemble('v_angle', 2, {
      form: 'angle',
      u: vec(1, 1, 0),
      v: vec(-1, 0, 1),
      theta: 120,
    });
    expectCorrect(item, scalar(120));
    expectDetects(item, 'V17_ANGLE_ABS', scalar(60));
    expectValid(item);
  });

  it('does not apply at 90°', () => {
    const item = assemble('v_angle', 2, {
      form: 'angle',
      u: vec(1, 0, 0),
      v: vec(0, 1, 0),
      theta: 90,
    });
    expect(item.diagnostics).toEqual([]);
  });
});

describe('V18_ANGLE_SQUARED_NORMS', () => {
  it('u = (1, 2), v = (3, 1) → cos θ = 5/√50 = √2/2 · candidate 5/50 = 1/10', () => {
    const item = assemble('v_angle', 1, { form: 'cos_angle', u: vec(1, 2), v: vec(3, 1) });
    expectCorrect(item, surd('1/2√2'));
    expectDetects(item, 'V18_ANGLE_SQUARED_NORMS', surd('1/10'));
    expectValid(item);
  });
});

describe('V19_PERP_AS_PARALLEL', () => {
  it('u = (2, k, −1) ⊥ v = (3, 1, 4) → 6 + k − 4 = 0, k = −2 · candidate 2/3 = k/1 → 2/3', () => {
    const item = assemble('v_perp', 2, {
      form: 'perp',
      u: [Rational.of(2), 'k', Rational.of(-1)],
      v: [Rational.of(3), Rational.of(1), Rational.of(4)],
    });
    expectCorrect(item, scalar(-2));
    expectDetects(item, 'V19_PERP_AS_PARALLEL', scalar('2/3'));
    expectValid(item);
  });
});

describe('V20, V21, V22 on u = (2, −1, 3), v = (1, 4, −2)', () => {
  const item = assemble('v_cross', 2, {
    form: 'cross',
    u: vec(2, -1, 3),
    v: vec(1, 4, -2),
    order: 'uv',
  });

  it('u × v = (−10, 7, 9)', () => {
    expectCorrect(item, vector(-10, 7, 9));
    expectValid(item);
  });

  it('V20 candidate (−10, −7, 9), one component away and marked oneOff', () => {
    expectDetects(item, 'V20_CROSS_MIDDLE_SIGN', vector(-10, -7, 9));
    expect(item.diagnostics.find((d) => d.id === 'V20_CROSS_MIDDLE_SIGN')?.oneOff).toBe(true);
  });

  it('V21 candidate (10, −7, −9)', () =>
    expectDetects(item, 'V21_CROSS_ORDER', vector(10, -7, -9)));

  it('V22 candidate (2, −4, −6)', () =>
    expectDetects(item, 'V22_CROSS_COMPONENTWISE', vector(2, -4, -6)));

  it('only V20 is allowed one component away', () => {
    for (const diagnostic of item.diagnostics) {
      expect(diagnostic.oneOff === true).toBe(diagnostic.id === 'V20_CROSS_MIDDLE_SIGN');
    }
  });

  it('V20 does not apply when |c₂| < 2', () => {
    const small = assemble('v_cross', 2, {
      form: 'cross',
      u: vec(1, -1, 0),
      v: vec(0, 1, 1),
      order: 'uv',
    });
    expectCorrect(small, vector(-1, -1, 1));
    expect(ids(small)).not.toContain('V20_CROSS_MIDDLE_SIGN');
  });

  it('asked as v × u, the answer and every candidate follow that order', () => {
    const reversed = assemble('v_cross', 3, {
      form: 'cross',
      u: vec(2, -1, 3),
      v: vec(1, 4, -2),
      order: 'vu',
    });
    expectCorrect(reversed, vector(10, -7, -9));
    expectDetects(reversed, 'V20_CROSS_MIDDLE_SIGN', vector(10, 7, -9));
    expectDetects(reversed, 'V21_CROSS_ORDER', vector(-10, 7, 9));
    expectDetects(reversed, 'V22_CROSS_COMPONENTWISE', vector(2, -4, -6));
  });
});

describe('V23_TRIANGLE_NO_HALF and V24_AREA_DOT', () => {
  const triangle = assemble('v_area', 2, {
    form: 'area_triangle',
    A: vec(1, 0, 1),
    B: vec(2, 2, 1),
    C: vec(4, 1, 3),
  });

  it('A(1, 0, 1), B(2, 2, 1), C(4, 1, 3): area 3√5/2', () => {
    expectCorrect(triangle, surd('3/2√5'));
    expectValid(triangle);
  });

  it('V23 candidate |AB × AC| = 3√5', () =>
    expectDetects(triangle, 'V23_TRIANGLE_NO_HALF', surd('3√5')));

  it('V24 on the triangle: ½|AB·AC| = 5/2', () =>
    expectDetects(triangle, 'V24_AREA_DOT', surd('5/2')));

  it('V24 on the parallelogram of AB = (1, 2, 0), AC = (3, 1, 2): correct 3√5, candidate 5', () => {
    const item = assemble('v_area', 1, {
      form: 'area_parallelogram',
      u: vec(1, 2, 0),
      v: vec(3, 1, 2),
    });
    expectCorrect(item, surd('3√5'));
    expectDetects(item, 'V24_AREA_DOT', surd('5'));
    expect(ids(item)).not.toContain('V23_TRIANGLE_NO_HALF');
    expectValid(item);
  });
});

describe('V25_VOLUME_SIGNED and V26_VOLUME_MAG_PRODUCT', () => {
  const item = assemble('v_volume', 2, {
    form: 'volume',
    u: vec(1, 2, 0),
    v: vec(2, 0, 1),
    w: vec(0, 1, 3),
  });

  it('u = (1, 2, 0), v = (2, 0, 1), w = (0, 1, 3) → u·(v × w) = −13, volume 13', () => {
    expectCorrect(item, surd('13'));
    expectValid(item);
  });

  it('V25 candidate −13', () => expectDetects(item, 'V25_VOLUME_SIGNED', surd('-13')));

  it('V26 candidate √5·√5·√10 = 5√10', () =>
    expectDetects(item, 'V26_VOLUME_MAG_PRODUCT', surd('5√10')));

  it('V25 does not apply when the triple product is positive', () => {
    const positive = assemble('v_volume', 1, {
      form: 'volume',
      u: vec(1, 2, 0),
      v: vec(0, 1, 3),
      w: vec(2, 0, 1),
    });
    expectCorrect(positive, surd('13'));
    expect(ids(positive)).not.toContain('V25_VOLUME_SIGNED');
  });

  it('V26 never on a right box', () => {
    const box = { u: vec(2, 0, 0), v: vec(0, 3, 0), w: vec(0, 0, 1) };
    expect(isRightBox(box.u, box.v, box.w)).toBe(true);
    const right = assemble('v_volume', 1, { form: 'volume', ...box });
    expectCorrect(right, surd('6'));
    expect(ids(right)).not.toContain('V26_VOLUME_MAG_PRODUCT');
  });
});

describe('the catalog', () => {
  it('has the 26 misconceptions of §4 in order, each with a name, hint and scene', () => {
    expect(CATALOG.map((entry) => entry.id)).toEqual([
      'V01_QUANTITY_MIX',
      'V02_EQUAL_IGNORES_DIRECTION',
      'V03_GEOM_SUB_DIRECTION',
      'V04_GEOM_ADD_JOIN_TIPS',
      'V05_POINTS_REVERSED',
      'V06_SCALAR_PARTIAL',
      'V07_COMBO_SIGN',
      'V08_PARALLEL_RATIO_FLIP',
      'V09_MAG_NO_ROOT',
      'V10_MAG_SUM_COMPONENTS',
      'V11_MAG_ADDITIVE',
      'V12_UNIT_SQUARED',
      'V13_UNIT_DIVIDE_SUM',
      'V14_DOT_AS_DET',
      'V15_DOT_NO_COS',
      'V16_DOT_SIN',
      'V17_ANGLE_ABS',
      'V18_ANGLE_SQUARED_NORMS',
      'V19_PERP_AS_PARALLEL',
      'V20_CROSS_MIDDLE_SIGN',
      'V21_CROSS_ORDER',
      'V22_CROSS_COMPONENTWISE',
      'V23_TRIANGLE_NO_HALF',
      'V24_AREA_DOT',
      'V25_VOLUME_SIGNED',
      'V26_VOLUME_MAG_PRODUCT',
    ]);
    for (const entry of CATALOG) {
      expect(entry.nameTh.length).toBeGreaterThan(0);
      expect(entry.shortTh.length).toBeGreaterThan(0);
      expect(entry.hintKey).toBe(entry.id);
    }
  });
});

const seedArb = fc.integer({ min: 0, max: 0xffffffff });

const PROBES: [MisconceptionId, SkillId, 1 | 2 | 3, string | undefined][] = CATALOG.flatMap(
  (entry) =>
    entry.skills.flatMap((skill) =>
      probeLevels(skill, entry.id).flatMap((level) =>
        variantsOf(entry.id).map(
          (variant): [MisconceptionId, SkillId, 1 | 2 | 3, string | undefined] => [
            entry.id,
            skill,
            level,
            variant,
          ],
        ),
      ),
    ),
);

describe('each candidate classifies as itself and never as correct', () => {
  it.each(PROBES)('%s on %s L%i', (id, skill, difficulty, targetVariant) => {
    fc.assert(
      fc.property(seedArb, (seed) => {
        const item = generate({ skill, difficulty, seed, target: id, targetVariant });
        const [first] = item.diagnostics;
        expect(first.id).toBe(id);
        for (const diagnostic of item.diagnostics) {
          if (diagnostic.answer.kind === 'any_matrix') throw new Error('no ANY_MATRIX in vectors');
          const result = classify(item, diagnostic.answer);
          expect(result).toEqual(
            diagnostic.variant === undefined
              ? { type: 'misconception', id: diagnostic.id }
              : { type: 'misconception', id: diagnostic.id, variant: diagnostic.variant },
          );
          expect(result.type).not.toBe('correct');
        }
      }),
    );
  });
});
