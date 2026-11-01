import { th } from '@/lib/content/th';
import type { Rational } from '@/lib/core/rational';
import { fillTokens } from '@/lib/core/tokens';
import type { Answer, Matrix } from '@/lib/core/types';
import { mul, sum } from '../ops';
import type {
  CellIndex,
  PairTerm,
  RowColBeat,
  RowColDotParams,
  RowColVariant,
  SceneSpecOf,
  ScenePurpose,
  WrongWork,
} from './types';

const BEAT_MS: Record<RowColBeat, number> = {
  compare: 3000,
  setup: 1500,
  pick_row: 1500,
  pick_col: 1500,
  pair: 2500,
  multiply: 2500,
  sum: 2000,
  place: 1500,
  fill_rest: 1500,
};

const term = (a: Rational, b: Rational): PairTerm => ({ a, b, product: a.mul(b) });

const rowOf = (A: Matrix, row: number): CellIndex[] => A[row].map((_, col) => [row + 1, col + 1]);

const colOf = (A: Matrix, col: number): CellIndex[] => A.map((_, row) => [row + 1, col + 1]);

/** The cells each wrong method reads for this answer cell, and what it adds up to. */
function wrongWork(
  variant: RowColVariant,
  left: Matrix,
  right: Matrix,
  [row, col]: CellIndex,
): WrongWork {
  const [i, j] = [row - 1, col - 1];
  const build = (
    leftCells: CellIndex[],
    rightCells: CellIndex[],
    terms: PairTerm[],
  ): WrongWork => ({
    variant,
    leftCells,
    rightCells,
    terms,
    value: sum(terms.map(({ product }) => product)),
  });
  switch (variant) {
    case 'elementwise':
      return build([[row, col]], [[row, col]], [term(left[i][j], right[i][j])]);
    case 'row_row':
      return build(
        rowOf(left, i),
        rowOf(right, j),
        left[i].map((cell, k) => term(cell, right[j][k])),
      );
    case 'col_col':
      return build(
        colOf(left, i),
        colOf(right, j),
        left.map((cells, k) => term(cells[i], right[k][j])),
      );
    case 'reversed':
      return build(
        colOf(left, j),
        rowOf(right, i),
        right[i].map((cell, k) => term(cell, left[k][j])),
      );
  }
}

export interface RowColDotInput {
  left: Matrix;
  right: Matrix;
  names?: RowColDotParams['names'];
  cell?: CellIndex;
  variant?: RowColVariant;
  studentAnswer?: Answer;
  purpose: ScenePurpose;
  captions?: Partial<Record<RowColBeat, string>>;
}

/** SCENES §3.1. The compare beat plays only when there is a wrong method to compare. */
export function rowColDotScene({
  left,
  right,
  names = { left: 'A', right: 'B', result: 'AB' },
  cell = [1, 1],
  variant,
  studentAnswer,
  purpose,
  captions,
}: RowColDotInput): SceneSpecOf<'row_col_dot'> {
  const [i, j] = [cell[0] - 1, cell[1] - 1];
  const product = mul(left, right);
  const copy = th.scenes.rowCol;
  const tokens = { i: String(cell[0]), j: String(cell[1]), ...names };

  const hasMoreCells = product.length * product[0].length > 1;
  const beats: RowColBeat[] = [
    ...(variant ? (['compare'] as const) : []),
    'setup',
    'pick_row',
    'pick_col',
    'pair',
    'multiply',
    'sum',
    'place',
    ...(hasMoreCells ? (['fill_rest'] as const) : []),
  ];

  return {
    template: 'row_col_dot',
    params: {
      left,
      right,
      product,
      names,
      cell,
      terms: left[i].map((value, k) => term(value, right[k][j])),
      ...(variant && { wrong: wrongWork(variant, left, right, cell) }),
    },
    beats,
    captions: {
      ...(variant && { compare: copy.compare[variant] }),
      setup: fillTokens(copy.setup, tokens),
      pick_row: fillTokens(copy.pick_row, tokens),
      pick_col: fillTokens(copy.pick_col, tokens),
      pair: copy.pair,
      multiply: copy.multiply,
      sum: copy.sum,
      place: copy.place,
      fill_rest: copy.fill_rest,
      ...captions,
    },
    beatMs: BEAT_MS,
    ...(studentAnswer && { compare: { studentAnswer, variant } }),
    purpose,
  };
}
