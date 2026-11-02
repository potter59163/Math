import { th } from '@/lib/content/th';
import { Rational } from '@/lib/core/rational';
import { fillTokens } from '@/lib/core/tokens';
import type { Answer, Matrix } from '@/lib/core/types';
import { rationalText } from '../format';
import { add, scalar, sub } from '../ops';
import { choiceOf } from './tryChoice';
import type {
  CellByCellBeat,
  CellByCellOp,
  CellIndex,
  CellWork,
  ScenePurpose,
  SceneSpecOf,
  TryChoice,
} from './types';
import { timedBeats, type VoiceId } from './voice';

const COMPARE_MS = 3000;
const SETUP_MS = 2000;
const CELL_MS = 3000;
const REST_MS = 2500;
const DONE_MS = 1500;
const ALSO_MS = 3500;
const TRY_MS = 1000;

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

/** The right way to write this cell against what this mistake would write. Null when they read alike. */
function questionFor(
  op: CellByCellOp,
  { a, b }: CellWork,
  k: Rational | undefined,
  variant: string | undefined,
): TryChoice | null {
  const salt = a.n + (b?.n ?? 0);
  if (op === 'sub' && b && !a.equals(b)) {
    return choiceOf(`${rationalText(a)} − ${term(b)}`, [`${rationalText(b)} − ${term(a)}`], salt);
  }
  if (op === 'scalar' && k) {
    const wrong = variant === 'ADD' ? `${term(k)} + ${term(a)}` : rationalText(a);
    return choiceOf(`${term(k)} × ${term(a)}`, [wrong], salt);
  }
  return null;
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
  const ordered = [...inOrder.filter(isFocus), ...inOrder.filter((cell) => !isFocus(cell))];
  const comparing = variant !== undefined;

  // The student works out the second cell, so a cell that could not ask anything stays out of that place.
  const askable = comparing
    ? ordered.slice(1).find((cell) => questionFor(op, cell, k, variant) !== null)
    : undefined;
  const work = askable
    ? [ordered[0], askable, ...ordered.slice(1).filter((cell) => cell !== askable)]
    : ordered;
  const question = askable ? questionFor(op, askable, k, variant) : null;

  const inFull = work.slice(0, CELLS_IN_FULL);
  const cellBeats = inFull.map((_, index): CellByCellBeat => `cell_${index + 1}`);
  const hasRest = work.length > inFull.length;

  const beats: CellByCellBeat[] = [
    ...(comparing ? (['compare'] as const) : []),
    'setup',
    ...(question ? [cellBeats[0], 'try' as const, 'try_done' as const] : cellBeats),
    ...(hasRest ? (['rest'] as const) : []),
    'done',
    ...(also ? (['also'] as const) : []),
  ];

  const place = (cell: CellWork) => ({ i: String(cell.i), j: String(cell.j) });
  const setupVoice: Record<CellByCellOp, VoiceId> = {
    add: purpose === 'intro' ? 'sheet.intro_setup' : 'sheet.setup_add',
    sub: 'sheet.setup_sub',
    scalar: 'sheet.setup_scalar',
  };
  const voice: Partial<Record<CellByCellBeat, VoiceId>> = {
    ...(comparing && { compare: `sheet.compare_${variant as keyof typeof copy.compare}` as const }),
    setup: setupVoice[op],
    cell_1: 'sheet.cell_1',
    cell_2: 'sheet.cell_2',
    rest: 'sheet.rest',
    done: 'sheet.done',
    also: 'sheet.also',
    try: 'sheet.try',
    try_done: 'sheet.try_done',
  };

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
      ...(question && { try: question }),
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
      ...(question && { try: copy.try, try_done: copy.try_done }),
      ...(hasRest && { rest: copy.rest }),
      done: copy.done,
      ...(also && { also: also.caption }),
      ...captions,
    },
    beatMs: timedBeats(
      {
        compare: COMPARE_MS,
        setup: SETUP_MS,
        ...Object.fromEntries(cellBeats.map((beat) => [beat, CELL_MS])),
        try: TRY_MS,
        try_done: CELL_MS,
        rest: REST_MS,
        done: DONE_MS,
        also: ALSO_MS,
      },
      voice,
    ),
    voice,
    ...(question && {
      waits: ['try'] as CellByCellBeat[],
      hints: {
        try: {
          caption: op === 'sub' ? copy.hint_sub : copy.hint_scalar,
          voice: op === 'sub' ? ('sheet.hint_sub' as const) : ('sheet.hint_scalar' as const),
        },
      },
    }),
    ...(comparing && { flagged: 'compare' as const }),
    ...(studentAnswer && { compare: { studentAnswer, variant } }),
    purpose,
  };
}
