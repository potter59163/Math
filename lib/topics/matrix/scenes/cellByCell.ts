import { th } from '@/lib/content/th';
import { Rational } from '@/lib/core/rational';
import { fillTokens } from '@/lib/core/tokens';
import type { Answer, Matrix } from '@/lib/core/types';
import { rationalText } from '../format';
import { add, scalar, sub } from '../ops';
import type {
  CellByCellBeat,
  CellByCellOp,
  CellIndex,
  CellWork,
  ScenePurpose,
  SceneSpecOf,
} from './types';

const COMPARE_MS = 3000;
const SETUP_MS = 2000;
const CELL_MS = 3000;
const REST_MS = 2500;
const DONE_MS = 1500;
const ALSO_MS = 3500;

/** Two cells worked out in full show the idea, and the rest fill in at once. */
const CELLS_IN_FULL = 2;

export interface CellByCellInput {
  op: CellByCellOp;
  left: Matrix;
  right?: Matrix;
  k?: Rational;
  names?: { left: string; right?: string; result: string };
  /** The cell to work out first: the first one the student got wrong, if there was one. */
  focus?: CellIndex;
  variant?: string;
  student?: Matrix;
  studentAnswer?: Answer;
  purpose: ScenePurpose;
  captions?: Partial<Record<CellByCellBeat, string>>;
  /** The intro of Unit 2 ends on kA, so that one clip opens both skills of the unit. */
  also?: { k: Rational; caption: string };
}

/** With brackets around a negative second term: 3 − (−2) rather than 3 − −2. */
function term(value: Rational): string {
  const text = rationalText(value);
  return value.sign() < 0 ? `(${text})` : text;
}

function expressionOf(
  op: CellByCellOp,
  a: Rational,
  b: Rational | undefined,
  k: Rational | undefined,
): { value: Rational; expression: string } {
  const value = op === 'scalar' ? k!.mul(a) : op === 'add' ? a.add(b!) : a.sub(b!);
  switch (op) {
    case 'add':
      return { value, expression: `${rationalText(a)} + ${term(b!)} = ${rationalText(value)}` };
    case 'sub':
      return { value, expression: `${rationalText(a)} − ${term(b!)} = ${rationalText(value)}` };
    case 'scalar':
      return { value, expression: `${term(k!)} × ${term(a)} = ${rationalText(value)}` };
  }
}

function resultOf(op: CellByCellOp, left: Matrix, right?: Matrix, k?: Rational): Matrix {
  switch (op) {
    case 'add':
      return add(left, right!);
    case 'sub':
      return sub(left, right!);
    case 'scalar':
      return scalar(k!, left);
  }
}

const DEFAULT_NAMES = { left: 'A', right: 'B', result: 'คำตอบ' };

/** SCENES §3.6: the same position in each, one cell at a time, for add, subtract and scale. */
export function cellByCellScene({
  op,
  left,
  right,
  k,
  names = DEFAULT_NAMES,
  focus,
  variant,
  student,
  studentAnswer,
  purpose,
  captions = {},
  also,
}: CellByCellInput): SceneSpecOf<'cell_by_cell'> {
  const copy = th.scenes.cellByCell;
  const inOrder: CellWork[] = left.flatMap((row, i) =>
    row.map((cell, j) => ({
      i: i + 1,
      j: j + 1,
      a: cell,
      ...(right && { b: right[i][j] }),
      ...expressionOf(op, cell, right?.[i][j], k),
    })),
  );
  const isFocus = ({ i, j }: CellWork) => focus?.[0] === i && focus?.[1] === j;
  const work = [...inOrder.filter(isFocus), ...inOrder.filter((cell) => !isFocus(cell))];
  const inFull = work.slice(0, CELLS_IN_FULL);
  const cellBeats = inFull.map((_, index): CellByCellBeat => `cell_${index + 1}`);
  const hasRest = work.length > inFull.length;
  const comparing = variant !== undefined;

  const beats: CellByCellBeat[] = [
    ...(comparing ? (['compare'] as const) : []),
    'setup',
    ...cellBeats,
    ...(hasRest ? (['rest'] as const) : []),
    'done',
    ...(also ? (['also'] as const) : []),
  ];

  const place = (cell: CellWork) => ({ i: String(cell.i), j: String(cell.j) });

  return {
    template: 'cell_by_cell',
    params: {
      op,
      left,
      ...(right && { right }),
      ...(k && { k }),
      result: resultOf(op, left, right, k),
      names,
      work,
      cellsInFull: inFull.length,
      ...(student && { student }),
      ...(variant && { variant }),
      ...(also && { also: { k: also.k, result: scalar(also.k, left) } }),
    },
    beats,
    captions: {
      ...(comparing && { compare: copy.compare[variant as keyof typeof copy.compare] }),
      setup: copy.setup[op],
      ...Object.fromEntries(
        inFull.map((cell, index) => [
          cellBeats[index],
          fillTokens(copy.cell, { ...place(cell), expression: cell.expression }),
        ]),
      ),
      ...(hasRest && { rest: copy.rest }),
      done: copy.done,
      ...(also && { also: also.caption }),
      ...captions,
    },
    beatMs: {
      compare: COMPARE_MS,
      setup: SETUP_MS,
      ...Object.fromEntries(cellBeats.map((beat) => [beat, CELL_MS])),
      rest: REST_MS,
      done: DONE_MS,
      also: ALSO_MS,
    },
    ...(comparing && { flagged: 'compare' as const }),
    ...(studentAnswer && { compare: { studentAnswer, variant } }),
    purpose,
  };
}
