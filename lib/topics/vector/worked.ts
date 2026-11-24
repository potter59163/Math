import type { VectorWorkedKey } from '@/lib/content/th.vector';
import { Rational } from '@/lib/core/rational';
import { Surd } from '@/lib/core/surd';
import type { Answer } from '@/lib/core/types';
import { linearExprText, signed } from './format';
import {
  arrow,
  degrees,
  factor,
  figureExpr,
  num,
  products,
  squares,
  surd,
  surdFactor,
  surdTuple,
  term as termLatex,
  tuple,
} from './latex';
import {
  add,
  cosAngle,
  cosOf,
  cross,
  crossTerms,
  dot,
  dotTerms,
  equals,
  norm,
  normSq,
  scale,
  sub,
  triple,
  unit,
} from './ops';
import {
  askedValue,
  crossFactors,
  isUnknown,
  linearVec,
  optionWithValue,
  parallelK,
  parallelPair,
  partnerOf,
  perpAnswer,
  perpPropertyAnswer,
  pointAt,
  termValue,
  triangleSides,
} from './solve';
import type {
  DataOf,
  Figure,
  PointLabel,
  Slot,
  Term,
  Vec,
  VectorAnswer,
  VectorData,
  VectorItem,
} from './types';

export interface Step {
  labelKey: VectorWorkedKey;
  params?: Record<string, string>;
  latex: string;
  /** What this step produced. The last step's value is always the correct answer. */
  value?: Answer;
  /** 1-based answer cells this step works out; component i of a vector is cell [i, 1]. */
  cells?: [number, number][];
}

export type WorkedFocus = { cell: [number, number] } | { step: number };

const asNumber = (value: Rational): Answer => ({ kind: 'scalar', value });
const asSurd = (value: Surd): Answer => ({ kind: 'surd', value });
const asVector = (value: Surd[]): Answer => ({ kind: 'vector', value });
const asSurds = (v: Vec): Surd[] => v.map((part) => Surd.rational(part));
const index = (i: number) => ({ i: String(i + 1) });
const cell = (i: number): [number, number][] => [[i + 1, 1]];

/** k·(from→to) as a whole named vector, using the midpoint for a half (½QS = QM). */
function wholeTerm(figure: Figure, t: Term): { from: PointLabel; to: PointLabel; step?: Step } {
  if (t.k.equals(Rational.ONE)) return { from: t.from, to: t.to };
  if (t.k.equals(Rational.ONE.neg())) {
    return {
      from: t.to,
      to: t.from,
      step: {
        labelKey: 'geom_reverse',
        latex: `${termLatex(t)} = ${arrow(t.to, t.from)}`,
      },
    };
  }
  const half = Rational.of(1, 2);
  if (t.k.equals(half)) {
    const mid = figure.midpoints.find(
      ({ of: [p, q] }) => (p === t.from && q === t.to) || (p === t.to && q === t.from),
    );
    if (!mid) throw new Error(`workedSteps: no midpoint on ${t.from}${t.to}`);
    return {
      from: t.from,
      to: mid.label,
      step: { labelKey: 'geom_half', latex: `${termLatex(t)} = ${arrow(t.from, mid.label)}` },
    };
  }
  throw new Error(`workedSteps: no named vector for ${t.k.toString()}${t.from}${t.to}`);
}

/** The named point P with P − `start` equal to the vector, if the figure has one. */
function landing(figure: Figure, start: PointLabel, by: Vec): PointLabel | null {
  const target = add(pointAt(figure, start), by);
  return figure.points.find((p) => equals(pointAt(figure, p.label), target))?.label ?? null;
}

/** Rewrites each term as a named vector, then joins them head to tail, moving one when needed. */
function figureExprSteps(data: DataOf<'figure_expr'>, correct: VectorAnswer): Step[] {
  const { figure, expr, options } = data;
  const steps: Step[] = [];
  const pieces = expr.map((t) => {
    const piece = wholeTerm(figure, t);
    if (piece.step) steps.push(piece.step);
    return piece;
  });
  let { from, to } = pieces[0];
  for (const next of pieces.slice(1)) {
    let [left, right] = [
      { from, to },
      { from: next.from, to: next.to },
    ];
    if (left.to !== right.from && right.to === left.from) [left, right] = [right, left];
    if (left.to !== right.from) {
      const moved = landing(
        figure,
        left.to,
        sub(pointAt(figure, right.to), pointAt(figure, right.from)),
      );
      if (!moved) throw new Error('workedSteps: cannot move the vector onto a named point');
      steps.push({
        labelKey: 'geom_translate',
        latex: `${arrow(right.from, right.to)} = ${arrow(left.to, moved)}`,
      });
      right = { from: left.to, to: moved };
    }
    steps.push({
      labelKey: 'geom_chain',
      latex: `${arrow(left.from, left.to)} + ${arrow(right.from, right.to)} = ${arrow(left.from, right.to)}`,
    });
    [from, to] = [left.from, right.to];
  }
  const answer = optionWithValue(figure, options, termValue(figure, { k: Rational.ONE, from, to }));
  if (!answer) throw new Error('workedSteps: the chain ends on no option');
  const last = steps[steps.length - 1];
  if (answer.from === from && answer.to === to && answer.k.equals(Rational.ONE)) {
    last.value = correct;
    return steps;
  }
  return [
    ...steps,
    { labelKey: 'geom_same', latex: `${arrow(from, to)} = ${termLatex(answer)}`, value: correct },
  ];
}

function figureEqualSteps(data: DataOf<'figure_equal'>, correct: VectorAnswer): Step[] {
  const { figure, of, negative, options } = data;
  const answer = optionWithValue(figure, options, askedValue(data));
  if (!answer) throw new Error('workedSteps: no option is the asked vector');
  const asked = termLatex(of);
  return [
    { labelKey: 'figure_length', latex: `|${asked}| = |${termLatex(answer)}|` },
    {
      labelKey: negative ? 'figure_negative_result' : 'figure_equal_result',
      latex: `${negative ? '-' : ''}${asked} = ${termLatex(answer)}`,
      value: correct,
    },
  ];
}

const AXIS = ['i', 'j', 'k'];

/** Three steps for u × v, one per component, as the cover-up rule does them. */
function crossSteps(first: Vec, second: Vec): Step[] {
  const terms = crossTerms(first, second);
  const symbols = ['a_2b_3 - a_3b_2', 'a_3b_1 - a_1b_3', 'a_1b_2 - a_2b_1'];
  const factors: [number, number][][] = [
    [
      [1, 2],
      [2, 1],
    ],
    [
      [2, 0],
      [0, 2],
    ],
    [
      [0, 1],
      [1, 0],
    ],
  ];
  return terms.map(([plus, minus], i): Step => {
    const [[a, b], [c, d]] = factors[i];
    const value = plus.sub(minus);
    return {
      labelKey: `cross_${AXIS[i]}` as VectorWorkedKey,
      latex: `c_${i + 1} = ${symbols[i]} = ${factor(first[a])} \\cdot ${factor(second[b])} - ${factor(first[c])} \\cdot ${factor(second[d])} = ${num(value)}`,
      value: asNumber(value),
      cells: cell(i),
    };
  });
}

function slotLatex(part: Slot): string {
  return isUnknown(part) ? part : factor(part);
}

function linearSteps(data: DataOf<'linear'>): Step[] {
  const { terms, notation } = data;
  const steps: Step[] = [];
  if (notation === 'ijk') {
    steps.push({
      labelKey: 'linear_read',
      latex: terms.map(({ name, vec }) => `${name} = ${tuple(vec)}`).join(',\\; '),
    });
  }
  const scaled = terms.map(({ k, vec }) => scale(Rational.of(Math.abs(k)), vec));
  if (terms.length > 1) {
    terms.forEach(({ k, name }, t) => {
      if (Math.abs(k) === 1) return;
      steps.push({
        labelKey: 'linear_scale',
        params: { k: signed(Math.abs(k)), name },
        latex: `${Math.abs(k)}${name} = ${tuple(scaled[t])}`,
      });
    });
  }
  const result = linearVec(terms);
  result.forEach((value, i) => {
    const latex =
      terms.length === 1
        ? `${num(Rational.of(terms[0].k))} \\cdot ${factor(terms[0].vec[i])}`
        : terms
            .map(({ k }, t) => {
              const part = factor(scaled[t][i]);
              if (t === 0) return k < 0 ? `-${part}` : part;
              return `${k < 0 ? '-' : '+'} ${part}`;
            })
            .join(' ');
    steps.push({
      labelKey: 'linear_component',
      params: index(i),
      latex: `${latex} = ${num(value)}`,
      value: asNumber(value),
      cells: cell(i),
    });
  });
  steps.push({
    labelKey: 'linear_result',
    latex: `${linearExprText(terms).replace(/−/g, '-')} = ${tuple(result)}`,
    value: asVector(asSurds(result)),
  });
  return steps;
}

function magnitudeSteps(name: string, w: Vec, before: Step[] = []): Step[] {
  const length = norm(w);
  return [
    ...before,
    {
      labelKey: 'magnitude_square',
      latex: `|${name}|^2 = ${squares(w)} = ${num(normSq(w))}`,
    },
    {
      labelKey: 'magnitude_root',
      latex: `|${name}| = \\sqrt{${num(normSq(w))}} = ${surd(length)}`,
      value: asSurd(length),
    },
  ];
}

function unitSteps(data: DataOf<'unit' | 'scaled_unit' | 'direction_cosines'>): Step[] {
  const { v } = data;
  const length = norm(v);
  const k = data.form === 'scaled_unit' ? data.length : 1;
  const parts = unit(v).map((part) => part.mul(k));
  const steps: Step[] = [
    {
      labelKey: 'unit_norm',
      latex: `|v| = \\sqrt{${squares(v)}} = ${surd(length)}`,
      value: asSurd(length),
    },
    ...parts.map((part, i): Step => ({
      labelKey: 'unit_component',
      params: index(i),
      latex: `${k === 1 ? '' : `${k} \\cdot `}\\frac{${num(v[i])}}{${surd(length)}} = ${surd(part)}`,
      value: asSurd(part),
      cells: cell(i),
    })),
  ];
  const answer = asVector(parts);
  if (data.form === 'scaled_unit') {
    return [
      ...steps,
      {
        labelKey: 'scaled_result',
        params: { length: signed(k) },
        latex: `${k}\\frac{v}{|v|} = ${surdTuple(parts)}`,
        value: answer,
      },
    ];
  }
  if (data.form === 'direction_cosines') {
    return [
      ...steps,
      {
        labelKey: 'dircos_result',
        latex: `(\\cos\\alpha, \\cos\\beta, \\cos\\gamma) = ${surdTuple(parts)}`,
        value: answer,
      },
    ];
  }
  return [
    ...steps,
    { labelKey: 'unit_result', latex: `\\frac{v}{|v|} = ${surdTuple(parts)}`, value: answer },
  ];
}

function anglePrelude(u: Vec, v: Vec): Step[] {
  const d = dot(u, v);
  return [
    {
      labelKey: 'angle_dot',
      latex: `u \\cdot v = ${products(dotTerms(u, v).map((_, i) => [u[i], v[i]] as const))} = ${num(d)}`,
      value: asSurd(Surd.rational(d)),
    },
    {
      labelKey: 'angle_norms',
      latex: `|u| = ${surd(norm(u))},\\; |v| = ${surd(norm(v))}`,
    },
  ];
}

function cosLatex(u: Vec, v: Vec): string {
  return `\\cos\\theta = \\frac{${num(dot(u, v))}}{${surdFactor(norm(u))} \\cdot ${surdFactor(norm(v))}} = ${surd(cosAngle(u, v))}`;
}

function parallelSteps(data: DataOf<'parallel'>, correct: VectorAnswer): Step[] {
  const i = parallelPair(data.u, data.v);
  if (i === null) throw new Error('workedSteps: no pair fixes k');
  const k = parallelK(data);
  const [ui, vi] = [data.u[i] as Rational, data.v[i] as Rational];
  const { at, partner } = partnerOf(data);
  const x = data.ask;
  const solveLatex =
    at.vector === 'u'
      ? `${x} = k \\cdot ${factor(partner)} = ${factor(k)} \\cdot ${factor(partner)}`
      : `${x} = \\frac{${num(partner)}}{k} = ${num(partner)} \\div ${factor(k)}`;
  const answer = correct.kind === 'scalar' ? correct.value : Rational.ZERO;
  return [
    {
      labelKey: 'parallel_k',
      latex: `k = \\frac{${num(ui)}}{${num(vi)}} = ${num(k)}`,
    },
    {
      labelKey: 'parallel_solve',
      params: { x },
      latex: `${solveLatex} = ${num(answer)}`,
      value: correct,
    },
  ];
}

function perpSteps(data: DataOf<'perp'>, correct: VectorAnswer): Step[] {
  const pairs = data.u.map((part, i) => `${slotLatex(part)} \\cdot ${slotLatex(data.v[i])}`);
  return [
    { labelKey: 'perp_dot', latex: `u \\cdot v = ${pairs.join(' + ')} = 0` },
    { labelKey: 'perp_solve', latex: `k = ${num(perpAnswer(data))}`, value: correct },
  ];
}

function perpPropertySteps(data: DataOf<'perp_property'>, correct: VectorAnswer): Step[] {
  const k = perpPropertyAnswer(data);
  const known = data.v.map((part) => (isUnknown(part) ? 'k^2' : `${factor(part)}^2`));
  return [
    { labelKey: 'perp_property_rule', latex: '(u + v) \\cdot (u - v) = |u|^2 - |v|^2 = 0' },
    {
      labelKey: 'perp_property_norms',
      latex: `|u|^2 = ${squares(data.u)} = ${num(normSq(data.u))},\\; |v|^2 = ${known.join(' + ')}`,
    },
    {
      labelKey: 'perp_property_solve',
      latex: `k^2 = ${num(k.mul(k))},\\; k = ${num(k)}`,
      value: correct,
    },
  ];
}

function buildSteps(data: VectorData, correct: VectorAnswer): Step[] {
  switch (data.form) {
    case 'quantity_kind':
      return [
        { labelKey: 'quantity_rule', latex: '' },
        { labelKey: 'quantity_answer', latex: '', value: correct },
      ];
    case 'figure_equal':
      return figureEqualSteps(data, correct);
    case 'figure_expr':
      return figureExprSteps(data, correct);
    case 'points': {
      const d = sub(data.B, data.A);
      return [
        ...d.map((value, i): Step => ({
          labelKey: 'points_component',
          params: index(i),
          latex: `${num(data.B[i])} - ${factor(data.A[i])} = ${num(value)}`,
          value: asNumber(value),
          cells: cell(i),
        })),
        {
          labelKey: 'points_result',
          latex: `${arrow('A', 'B')} = B - A = ${tuple(d)}`,
          value: asVector(asSurds(d)),
        },
      ];
    }
    case 'fourth_vertex': {
      const bc = sub(data.C, data.B);
      const d = add(data.A, bc);
      return [
        { labelKey: 'vertex_rule', latex: `${arrow('A', 'D')} = ${arrow('B', 'C')}` },
        {
          labelKey: 'vertex_bc',
          latex: `${arrow('B', 'C')} = ${tuple(data.C)} - ${tuple(data.B)} = ${tuple(bc)}`,
        },
        ...d.map((value, i): Step => ({
          labelKey: 'vertex_component',
          params: index(i),
          latex: `${num(data.A[i])} + ${factor(bc[i])} = ${num(value)}`,
          value: asNumber(value),
          cells: cell(i),
        })),
        { labelKey: 'vertex_result', latex: `D = ${tuple(d)}`, value: asVector(asSurds(d)) },
      ];
    }
    case 'linear':
      return linearSteps(data);
    case 'parallel':
      return parallelSteps(data, correct);
    case 'magnitude':
      return magnitudeSteps('v', data.v);
    case 'magnitude_combo': {
      const name = linearExprText(data.terms);
      const w = linearVec(data.terms);
      return magnitudeSteps(name, w, [
        { labelKey: 'magnitude_vector', latex: `${name} = ${tuple(w)}` },
      ]);
    }
    case 'distance': {
      const d = sub(data.B, data.A);
      return magnitudeSteps(arrow('A', 'B'), d, [
        { labelKey: 'magnitude_vector', latex: `${arrow('A', 'B')} = B - A = ${tuple(d)}` },
      ]);
    }
    case 'unit':
    case 'scaled_unit':
    case 'direction_cosines':
      return unitSteps(data);
    case 'dot': {
      const d = dot(data.u, data.v);
      return [
        {
          labelKey: 'dot_pairs',
          latex: `u \\cdot v = ${products(data.u.map((part, i) => [part, data.v[i]] as const))} = ${num(d)}`,
          value: correct,
        },
      ];
    }
    case 'dot_polar': {
      const cos = cosOf(data.theta);
      const answer = data.normU.mul(data.normV).mul(cos);
      return [
        { labelKey: 'dot_cos', latex: `\\cos ${degrees(data.theta)} = ${surd(cos)}` },
        {
          labelKey: 'dot_polar',
          latex: `u \\cdot v = |u||v|\\cos\\theta = ${surdFactor(data.normU)} \\cdot ${surdFactor(data.normV)} \\cdot ${surdFactor(cos)} = ${surd(answer)}`,
          value: correct,
        },
      ];
    }
    case 'cos_angle':
      return [
        ...anglePrelude(data.u, data.v),
        { labelKey: 'cos_result', latex: cosLatex(data.u, data.v), value: correct },
      ];
    case 'angle':
      return [
        ...anglePrelude(data.u, data.v),
        { labelKey: 'cos_result', latex: cosLatex(data.u, data.v) },
        { labelKey: 'angle_result', latex: `\\theta = ${degrees(data.theta)}`, value: correct },
      ];
    case 'perp':
      return perpSteps(data, correct);
    case 'perp_property':
      return perpPropertySteps(data, correct);
    case 'cross': {
      const [first, second] = crossFactors(data);
      const [a, b] = data.order === 'uv' ? ['u', 'v'] : ['v', 'u'];
      const c = cross(first, second);
      return [
        ...crossSteps(first, second),
        {
          labelKey: 'cross_check',
          latex: `(${a} \\times ${b}) \\cdot ${a} = ${num(dot(c, first))},\\; (${a} \\times ${b}) \\cdot ${b} = ${num(dot(c, second))}`,
        },
        { labelKey: 'cross_result', latex: `${a} \\times ${b} = ${tuple(c)}`, value: correct },
      ];
    }
    case 'area_parallelogram': {
      const c = cross(data.u, data.v);
      return [
        { labelKey: 'area_cross', latex: `u \\times v = ${tuple(c)}` },
        {
          labelKey: 'area_norm',
          latex: `|u \\times v| = \\sqrt{${squares(c)}} = ${surd(norm(c))}`,
          value: correct,
        },
      ];
    }
    case 'area_triangle': {
      const [ab, ac] = triangleSides(data);
      const c = cross(ab, ac);
      const sides = `${arrow('A', 'B')} \\times ${arrow('A', 'C')}`;
      return [
        {
          labelKey: 'area_sides',
          latex: `${arrow('A', 'B')} = ${tuple(ab)},\\; ${arrow('A', 'C')} = ${tuple(ac)}`,
        },
        { labelKey: 'area_cross', latex: `${sides} = ${tuple(c)}` },
        { labelKey: 'area_norm', latex: `|${sides}| = \\sqrt{${squares(c)}} = ${surd(norm(c))}` },
        {
          labelKey: 'area_half',
          latex: `\\frac{1}{2}|${sides}| = ${surd(norm(c).div(2))}`,
          value: correct,
        },
      ];
    }
    case 'volume': {
      const c = cross(data.v, data.w);
      const t = triple(data.u, data.v, data.w);
      return [
        { labelKey: 'volume_cross', latex: `v \\times w = ${tuple(c)}` },
        {
          labelKey: 'volume_dot',
          latex: `u \\cdot (v \\times w) = ${products(data.u.map((part, i) => [part, c[i]] as const))} = ${num(t)}`,
        },
        {
          labelKey: 'volume_abs',
          latex: `|u \\cdot (v \\times w)| = |${num(t)}| = ${num(t.abs())}`,
          value: correct,
        },
      ];
    }
  }
}

/**
 * The solution, one step at a time. A focus keeps it to what hint L3 may show: one component or one
 * step, never the finished answer.
 */
export function workedSteps(
  item: Pick<VectorItem, 'data' | 'correct'>,
  focus?: WorkedFocus,
): Step[] {
  const steps = buildSteps(item.data, item.correct);
  if (focus === undefined) return steps;
  if ('step' in focus) return steps.slice(focus.step, focus.step + 1);
  const [row, col] = focus.cell;
  return steps.filter((step) => step.cells?.some(([i, j]) => i === row && j === col));
}

/** A one-step solution is the answer itself, so its hint stops short of the result. */
function withoutResult(data: VectorData, step: Step): Step {
  switch (data.form) {
    case 'dot':
      return {
        labelKey: step.labelKey,
        latex: `u \\cdot v = ${products(data.u.map((part, i) => [part, data.v[i]] as const))}`,
      };
    case 'figure_expr':
      return { labelKey: 'geom_chain', latex: figureExpr(data.expr) };
    default:
      throw new Error(`hintStep: ${data.form} has more than one step`);
  }
}

/** Hint L3: one component or one step of the solution, never the finished answer. */
export function hintStep(item: Pick<VectorItem, 'data' | 'correct'>): Step {
  const steps = buildSteps(item.data, item.correct);
  if (steps.length === 1) return withoutResult(item.data, steps[0]);
  const [first] = item.correct.kind === 'vector' ? workedSteps(item, { cell: [1, 1] }) : [];
  return first ?? steps[0];
}
