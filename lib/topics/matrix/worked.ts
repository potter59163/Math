import type { WorkedKey } from '@/lib/content/th';
import { Rational } from '@/lib/core/rational';
import type { Answer, Dims, Matrix } from '@/lib/core/types';
import { dimsLabel, signed } from './format';
import { dims, dot, factor, mat, num } from './latex';
import {
  add,
  adjugate2,
  det2,
  matrix,
  mul,
  sameShape,
  sarrusLines,
  scalar,
  shape,
  sum,
  transpose,
} from './ops';
import type { DataOf, MatrixData, MatrixItem } from './types';

export interface Step {
  labelKey: WorkedKey;
  params?: Record<string, string>;
  latex: string;
  /** What this step produced. The last step's value is always the correct answer. */
  value?: Answer;
  /** 1-based answer cells this step works out, so a hint can show one without the rest. */
  cells?: [number, number][];
}

export type WorkedFocus = { cell: [number, number] } | { step: number };

const asMatrix = (value: Matrix): Answer => ({ kind: 'matrix', value });
const asNumber = (value: Rational): Answer => ({ kind: 'scalar', value });
const asDims = ({ rows, cols }: Dims): Answer => ({ kind: 'dims', rows, cols });
const asChoice = (id: string): Answer => ({ kind: 'choice', id });

const cellParams = (i: number, j: number) => ({ i: String(i), j: String(j) });

/** One step per answer cell, computed by `cell` from 0-based indices. */
function perCell(
  labelKey: WorkedKey,
  rows: number,
  cols: number,
  cell: (i: number, j: number) => { latex: string; value: Rational },
  extraParams: Record<string, string> = {},
): Step[] {
  const steps: Step[] = [];
  for (let i = 0; i < rows; i += 1) {
    for (let j = 0; j < cols; j += 1) {
      const { latex, value } = cell(i, j);
      steps.push({
        labelKey,
        params: { ...cellParams(i + 1, j + 1), ...extraParams },
        latex,
        value: asNumber(value),
        cells: [[i + 1, j + 1]],
      });
    }
  }
  return steps;
}

/** The cell-by-cell product A·B, with the symbolic form the docs use: c₁₁ = a₁₁b₁₁ + a₁₂b₂₁ = … */
function productSteps(A: Matrix, B: Matrix, left: string, right: string): Step[] {
  const { rows } = shape(A);
  const { cols } = shape(B);
  const product = mul(A, B);
  return perCell('mult_cell', rows, cols, (i, j) => {
    const terms = A[i].map((_, k) => `${left}_{${i + 1}${k + 1}}${right}_{${k + 1}${j + 1}}`);
    const pairs = A[i].map((cell, k) => [cell, B[k][j]]);
    return {
      latex: `c_{${i + 1}${j + 1}} = ${terms.join(' + ')} = ${dot(pairs)} = ${num(product[i][j])}`,
      value: product[i][j],
    };
  });
}

function det2Latex(A: Matrix): string {
  const [[a, b], [c, d]] = A;
  return `ad - bc = ${factor(a)} \\cdot ${factor(d)} - ${factor(b)} \\cdot ${factor(c)} = ${num(det2(A))}`;
}

function sarrusSteps(A: Matrix): { steps: Step[]; det: Rational } {
  const { down, up } = sarrusLines(A);
  const [downSum, upSum] = [sum(down), sum(up)];
  const det = downSum.sub(upSum);
  const line = (values: Rational[]) => values.map(factor).join(' + ');
  return {
    det,
    steps: [
      {
        labelKey: 'det3_down',
        latex: `aei + bfg + cdh = ${line(down)} = ${num(downSum)}`,
        value: asNumber(downSum),
      },
      {
        labelKey: 'det3_up',
        latex: `ceg + afh + bdi = ${line(up)} = ${num(upSum)}`,
        value: asNumber(upSum),
      },
      {
        labelKey: 'det3_result',
        latex: `\\det(A) = ${factor(downSum)} - ${factor(upSum)} = ${num(det)}`,
        value: asNumber(det),
      },
    ],
  };
}

function innerStep(first: Dims, second: Dims): Step {
  return {
    labelKey: 'defined_inner',
    params: { n: String(first.cols), r: String(second.rows) },
    latex: `(${dims(first)}) \\cdot (${dims(second)})`,
  };
}

function multDefinedSteps({ order, dimsA, dimsB }: DataOf<'mult_defined'>): Step[] {
  const [first, second] = order === 'AB' ? [dimsA, dimsB] : [dimsB, dimsA];
  if (first.cols !== second.rows) {
    return [
      innerStep(first, second),
      {
        labelKey: 'defined_undefined',
        latex: `${first.cols} \\neq ${second.rows}`,
        value: { kind: 'undefined' },
      },
    ];
  }
  const result = { rows: first.rows, cols: second.cols };
  return [
    innerStep(first, second),
    { labelKey: 'defined_result', latex: dims(result), value: asDims(result) },
  ];
}

function chainSteps({ dimsA, dimsB, dimsC }: DataOf<'mult_defined_abc'>): Step[] {
  const undefinedStep = (left: Dims, right: Dims): Step => ({
    labelKey: 'defined_undefined',
    latex: `${left.cols} \\neq ${right.rows}`,
    value: { kind: 'undefined' },
  });
  const steps: Step[] = [{ ...innerStep(dimsA, dimsB), labelKey: 'abc_first' }];
  if (dimsA.cols !== dimsB.rows) return [...steps, undefinedStep(dimsA, dimsB)];
  const ab = { rows: dimsA.rows, cols: dimsB.cols };
  steps.push({ labelKey: 'defined_result', latex: dims(ab), value: asDims(ab) });
  steps.push({ ...innerStep(ab, dimsC), labelKey: 'abc_second' });
  if (ab.cols !== dimsC.rows) return [...steps, undefinedStep(ab, dimsC)];
  const abc = { rows: ab.rows, cols: dimsC.cols };
  return [...steps, { labelKey: 'defined_result', latex: dims(abc), value: asDims(abc) }];
}

// Counterexample for the true/false items; the numbers are the ones in MISCONCEPTIONS §3 (M22).
const X = matrix([
  [1, 1],
  [0, 1],
]);
const Y = matrix([
  [1, 0],
  [1, 1],
]);

function statementSteps(correct: Answer): Step[] {
  return [
    { labelKey: 'noncomm_example', latex: `XY = ${mat(X)}${mat(Y)} = ${mat(mul(X, Y))}` },
    { labelKey: 'noncomm_example_swapped', latex: `YX = ${mat(Y)}${mat(X)} = ${mat(mul(Y, X))}` },
    { labelKey: 'noncomm_example_differ', latex: 'XY \\neq YX', value: correct },
  ];
}

function inverseSteps(A: Matrix): Step[] {
  const [[a, b], [c, d]] = A;
  const det = det2(A);
  const adjugate = adjugate2(A);
  return [
    {
      labelKey: 'inv2_swap',
      latex: mat([
        [d, b],
        [c, a],
      ]),
      cells: [
        [1, 1],
        [2, 2],
      ],
    },
    {
      labelKey: 'inv2_negate',
      latex: mat(adjugate),
      cells: [
        [1, 2],
        [2, 1],
      ],
    },
    { labelKey: 'inv2_det', latex: `\\det(A) = ${det2Latex(A)}`, value: asNumber(det) },
    {
      labelKey: 'inv2_divide',
      latex: `A^{-1} = \\frac{1}{${num(det)}}${mat(adjugate)} = ${mat(scalar(det.inv(), adjugate))}`,
      value: asMatrix(scalar(det.inv(), adjugate)),
    },
  ];
}

function buildSteps(data: MatrixData, correct: Answer): Step[] {
  switch (data.form) {
    case 'dim': {
      const { rows, cols } = shape(data.A);
      return [
        { labelKey: 'dim_rows', params: { rows: String(rows) }, latex: `m = ${rows}` },
        { labelKey: 'dim_cols', params: { cols: String(cols) }, latex: `n = ${cols}` },
        { labelKey: 'dim_result', latex: dims({ rows, cols }), value: asDims({ rows, cols }) },
      ];
    }
    case 'index': {
      const value = data.A[data.i - 1][data.j - 1];
      return [
        {
          labelKey: 'index_locate',
          params: cellParams(data.i, data.j),
          latex: `a_{${data.i}${data.j}} = ${num(value)}`,
          value: asNumber(value),
        },
      ];
    }
    case 'transpose': {
      const result = transpose(data.A);
      return [
        ...data.A.map((row, i): Step => ({
          labelKey: 'transpose_row',
          params: { i: String(i + 1) },
          latex: `${mat([row])} \\to ${mat(row.map((cell) => [cell]))}`,
          cells: row.map((_, r): [number, number] => [r + 1, i + 1]),
        })),
        { labelKey: 'transpose_result', latex: `A^{T} = ${mat(result)}`, value: asMatrix(result) },
      ];
    }
    case 'addsub': {
      const { op, A, B } = data;
      const dimsStep: Step = {
        labelKey: 'addsub_dims',
        params: { dimsA: dimsLabel(shape(A)), dimsB: dimsLabel(shape(B)) },
        latex: `A_{${dims(shape(A))}},\\; B_{${dims(shape(B))}}`,
      };
      if (!sameShape(A, B)) {
        return [
          dimsStep,
          {
            labelKey: 'addsub_undefined',
            latex: `${dims(shape(A))} \\neq ${dims(shape(B))}`,
            value: { kind: 'undefined' },
          },
        ];
      }
      const symbol = op === 'add' ? '+' : '-';
      const combine = (a: Rational, b: Rational) => (op === 'add' ? a.add(b) : a.sub(b));
      const result = A.map((row, i) => row.map((cell, j) => combine(cell, B[i][j])));
      const { rows, cols } = shape(A);
      return [
        ...perCell('addsub_cell', rows, cols, (i, j) => ({
          latex: `${factor(A[i][j])} ${symbol} ${factor(B[i][j])} = ${num(result[i][j])}`,
          value: result[i][j],
        })),
        {
          labelKey: 'addsub_result',
          latex: `A ${symbol} B = ${mat(result)}`,
          value: asMatrix(result),
        },
      ];
    }
    case 'scalar': {
      const k = Rational.of(data.k);
      const result = scalar(k, data.A);
      const { rows, cols } = shape(data.A);
      return [
        ...perCell(
          'scalar_cell',
          rows,
          cols,
          (i, j) => ({
            latex: `${factor(k)} \\cdot ${factor(data.A[i][j])} = ${num(result[i][j])}`,
            value: result[i][j],
          }),
          { k: signed(data.k) },
        ),
        {
          labelKey: 'scalar_result',
          latex: `${num(k)}A = ${mat(result)}`,
          value: asMatrix(result),
        },
      ];
    }
    case 'combo': {
      const scaledA = scalar(Rational.of(data.p), data.A);
      const scaledB = scalar(Rational.of(data.q), data.B);
      const result = scaledA.map((row, i) => row.map((cell, j) => cell.sub(scaledB[i][j])));
      const { rows, cols } = shape(data.A);
      return [
        {
          labelKey: 'combo_scale_a',
          params: { p: signed(data.p) },
          latex: `${data.p}A = ${mat(scaledA)}`,
          value: asMatrix(scaledA),
        },
        {
          labelKey: 'combo_scale_b',
          params: { q: signed(data.q) },
          latex: `${data.q}B = ${mat(scaledB)}`,
          value: asMatrix(scaledB),
        },
        ...perCell('combo_cell', rows, cols, (i, j) => ({
          latex: `${factor(scaledA[i][j])} - ${factor(scaledB[i][j])} = ${num(result[i][j])}`,
          value: result[i][j],
        })),
        {
          labelKey: 'combo_result',
          latex: `${data.p}A - ${data.q}B = ${mat(result)}`,
          value: asMatrix(result),
        },
      ];
    }
    case 'mult_defined':
      return multDefinedSteps(data);
    case 'mult_defined_abc':
      return chainSteps(data);
    case 'mult':
      return [
        ...productSteps(data.A, data.B, 'a', 'b'),
        {
          labelKey: 'mult_result',
          latex: `AB = ${mat(mul(data.A, data.B))}`,
          value: asMatrix(mul(data.A, data.B)),
        },
      ];
    case 'noncomm_statement':
      return statementSteps(correct);
    case 'noncomm_find_ba':
      return [
        ...productSteps(data.B, data.A, 'b', 'a'),
        {
          labelKey: 'mult_result',
          latex: `BA = ${mat(mul(data.B, data.A))}`,
          value: asMatrix(mul(data.B, data.A)),
        },
      ];
    case 'noncomm_pair': {
      const ab = mul(data.A, data.B);
      const ba = mul(data.B, data.A);
      const isSame = correct.kind === 'choice' && correct.id === 'swap_yes';
      return [
        { labelKey: 'noncomm_ab', latex: `AB = ${mat(ab)}`, value: asMatrix(ab) },
        { labelKey: 'noncomm_ba', latex: `BA = ${mat(ba)}`, value: asMatrix(ba) },
        {
          labelKey: isSame ? 'noncomm_same' : 'noncomm_differ',
          latex: isSame ? 'AB = BA' : 'AB \\neq BA',
          value: correct,
        },
      ];
    }
    case 'det2':
      return [
        {
          labelKey: 'det2_formula',
          latex: `\\det(A) = ${det2Latex(data.A)}`,
          value: asNumber(det2(data.A)),
        },
      ];
    case 'det3':
      return sarrusSteps(data.A).steps;
    case 'det_scaled': {
      const { n, d, k } = data;
      const result = Rational.of(k).pow(n).mul(Rational.of(d));
      return [
        {
          labelKey: 'det_scaled_rule',
          params: { n: String(n) },
          latex: `\\det(kA) = k^{${n}} \\det(A)`,
        },
        {
          labelKey: 'det_scaled_value',
          latex: `${factor(Rational.of(k))}^{${n}} \\cdot ${factor(Rational.of(d))} = ${num(result)}`,
          value: asNumber(result),
        },
      ];
    }
    case 'det_product': {
      const [p, q] = [Rational.of(data.p), Rational.of(data.q)];
      return [
        {
          labelKey: 'det_product_rule',
          latex: `\\det(AB) = \\det(A)\\det(B) = ${factor(p)} \\cdot ${factor(q)} = ${num(p.mul(q))}`,
          value: asNumber(p.mul(q)),
        },
      ];
    }
    case 'det_sum': {
      const total = add(data.A, data.B);
      return [
        { labelKey: 'det_sum_add', latex: `A + B = ${mat(total)}`, value: asMatrix(total) },
        {
          labelKey: 'det_sum_det',
          latex: `\\det(A + B) = ${det2Latex(total)}`,
          value: asNumber(det2(total)),
        },
      ];
    }
    case 'det_transpose':
      return [
        {
          labelKey: 'det_transpose_rule',
          latex: `\\det(A^{T}) = \\det(A) = ${num(Rational.of(data.d))}`,
          value: asNumber(Rational.of(data.d)),
        },
      ];
    case 'det_inverse':
      return [
        {
          labelKey: 'det_inverse_rule',
          latex: `\\det(A^{-1}) = \\frac{1}{\\det(A)} = ${num(Rational.of(1, data.d))}`,
          value: asNumber(Rational.of(1, data.d)),
        },
      ];
    case 'invertible': {
      const has = correct.kind === 'choice' && correct.id === 'has_inverse';
      const detSteps: Step[] =
        data.A.length === 2
          ? [
              {
                labelKey: 'invertible_det',
                latex: `\\det(A) = ${det2Latex(data.A)}`,
                value: asNumber(det2(data.A)),
              },
            ]
          : sarrusSteps(data.A).steps;
      return [
        ...detSteps,
        {
          labelKey: has ? 'invertible_has' : 'invertible_none',
          latex: has ? '\\det(A) \\neq 0' : '\\det(A) = 0',
          value: asChoice(has ? 'has_inverse' : 'no_inverse'),
        },
      ];
    }
    case 'inv2':
      return inverseSteps(data.A);
  }
}

/**
 * The solution, one step at a time (SPEC §6). A focus keeps it to what hint L3 may show: one cell or
 * one step, never the finished answer.
 */
export function workedSteps(
  item: Pick<MatrixItem, 'data' | 'correct'>,
  focus?: WorkedFocus,
): Step[] {
  const steps = buildSteps(item.data, item.correct);
  if (focus === undefined) return steps;
  if ('step' in focus) return steps.slice(focus.step, focus.step + 1);
  const [row, col] = focus.cell;
  return steps.filter((step) => step.cells?.some(([i, j]) => i === row && j === col));
}
