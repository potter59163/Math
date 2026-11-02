import { th } from '@/lib/content/th';
import type { Rational } from '@/lib/core/rational';
import { fillTokens } from '@/lib/core/tokens';
import type { Answer, Matrix } from '@/lib/core/types';
import type { ThemeId } from '@/lib/learner/types';
import { rationalText } from '../format';
import { mul, sum } from '../ops';
import type {
  CellIndex,
  PairTerm,
  RowColBeat,
  RowColDotParams,
  RowColStory,
  RowColVariant,
  SceneSpecOf,
  ScenePurpose,
  WrongWork,
} from './types';
import { timedBeats, type VoiceId } from './voice';

const BEAT_MS: Record<RowColBeat, number> = {
  compare: 3400,
  setup: 1800,
  pick_row: 2600,
  pick_col: 2600,
  pair: 2000,
  only_first: 3400,
  multiply: 2600,
  sum: 2400,
  place: 2400,
  try_row: 1000,
  try_col: 1000,
  try_done: 3000,
  fill_rest: 2200,
  end: 2000,
};

const PLAIN_VOICE = {
  setup: 'bill.setup',
  pick_row: 'bill.pick_row',
  pick_col: 'bill.pick_col',
  multiply: 'bill.multiply',
  sum: 'bill.sum',
  place: 'bill.place',
  fill_rest: 'bill.fill_rest',
  try_row: 'bill.try_row',
  try_col: 'bill.try_col',
  try_done: 'bill.try_done',
  end: 'bill.end_plain',
} as const satisfies Partial<Record<RowColBeat, VoiceId>>;

/** The same steps, told as adding up a bill. */
const BILL_VOICE = {
  ...PLAIN_VOICE,
  setup: 'bill.intro_setup',
  pick_row: 'bill.story_pick_row',
  pick_col: 'bill.story_pick_col',
  pair: 'bill.pair',
  only_first: 'bill.only_first',
  multiply: 'bill.story_multiply',
  sum: 'bill.story_sum',
  place: 'bill.story_place',
  fill_rest: 'bill.story_fill',
  end: 'bill.end',
} as const satisfies Partial<Record<RowColBeat, VoiceId>>;

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

/** A cell other than the focus, in another row if one was wrong there, since that shows the most. */
function cellToTry(
  student: Matrix | undefined,
  product: Matrix,
  [row, col]: [number, number],
): CellIndex | undefined {
  const others = product.flatMap((cells, i) =>
    cells.map((_, j) => [i, j] as [number, number]).filter(([, j]) => i !== row || j !== col),
  );
  const wrong = ([i, j]: [number, number]) => student && !student[i][j].equals(product[i][j]);
  const cell =
    others.find((other) => wrong(other) && other[0] !== row && other[1] === col) ??
    others.find(wrong) ??
    others[0];
  return cell && [cell[0] + 1, cell[1] + 1];
}

const countable = (value: Rational) => value.isInteger() && value.sign() >= 0;

/**
 * The bill for a student who multiplied cell by cell, or null when that story cannot be told honestly,
 * and then they get the plain clip. A negative or a fraction is not a number of swords. And only on the
 * diagonal is "the same position" a line of the bill at all: a cell at row i and column j there is
 * A[i][j] × B[j][j], not A[i][j] × B[i][j].
 */
export function billOf(
  left: Matrix,
  right: Matrix,
  student: Matrix,
  theme: ThemeId,
): { cell: CellIndex; story: RowColStory } | null {
  const product = mul(left, right);
  const story = th.scenes.intro.stories[theme];
  if (left[0].length > story.labels.cols.length || product.length !== product[0].length) {
    return null;
  }
  const fits = (row: number) =>
    row < story.labels.rows.length &&
    left[row].every(countable) &&
    right.every((cells) => countable(cells[row]));
  const row = product.findIndex(
    (_, i) =>
      fits(i) &&
      !student[i][i].equals(product[i][i]) &&
      student[i][i].equals(left[i][i].mul(right[i][i])),
  );
  if (row < 0) return null;
  return {
    cell: [row + 1, row + 1],
    story: {
      who: story.labels.rows[row],
      labels: { qty: story.u3.left, price: story.u3.right, result: story.u3.result },
      items: story.labels.cols,
    },
  };
}

export interface RowColDotInput {
  left: Matrix;
  right: Matrix;
  names?: RowColDotParams['names'];
  cell?: CellIndex;
  variant?: RowColVariant;
  student?: Matrix;
  story?: RowColStory;
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
  student,
  story,
  studentAnswer,
  purpose,
  captions,
}: RowColDotInput): SceneSpecOf<'row_col_dot'> {
  const [i, j] = [cell[0] - 1, cell[1] - 1];
  const product = mul(left, right);
  const copy = th.scenes.rowCol;
  const receipt = th.clip.receipt;
  const tokens = { i: String(cell[0]), j: String(cell[1]), ...names };
  const terms = left[i].map((value, k) => term(value, right[k][j]));

  const hasMoreCells = product.length * product[0].length > 1;
  const correcting = variant !== undefined;
  const tryCell = correcting && hasMoreCells ? cellToTry(student, product, [i, j]) : undefined;
  const tryTerms = tryCell && left[tryCell[0] - 1].map((a, k) => term(a, right[k][tryCell[1] - 1]));
  const billing = correcting && story !== undefined;

  const beats: RowColBeat[] = correcting
    ? [
        'compare',
        'pick_row',
        'pick_col',
        billing ? 'only_first' : 'multiply',
        'sum',
        'place',
        ...(tryCell ? (['try_row', 'try_col', 'try_done'] as const) : []),
        'end',
      ]
    : [
        'setup',
        'pick_row',
        'pick_col',
        ...(story ? (['pair'] as const) : []),
        'multiply',
        'sum',
        'place',
        ...(hasMoreCells ? (['fill_rest'] as const) : []),
      ];

  const voice: Partial<Record<RowColBeat, VoiceId>> = {
    ...(story ? BILL_VOICE : PLAIN_VOICE),
    ...(billing && { sum: 'bill.all_lines' as const }),
    ...(variant === 'elementwise' && { end: 'bill.end' as const }),
    ...(variant && { compare: `bill.compare_${variant}` as const }),
  };

  const billCaptions =
    story && correcting && student
      ? Object.fromEntries(
          Object.entries(receipt.captions).map(([beat, caption]) => [
            beat,
            fillTokens(caption, {
              mine: rationalText(student[i][j]),
              right: rationalText(product[i][j]),
              who: story.who,
              qty: story.labels.qty,
              price: story.labels.price,
              theirs: story.items[i],
              other: story.items[(i + 1) % terms.length],
            }),
          ]),
        )
      : {};

  return {
    template: 'row_col_dot',
    params: {
      left,
      right,
      product,
      names,
      cell,
      terms,
      ...(variant && { wrong: wrongWork(variant, left, right, cell) }),
      ...(student && { student }),
      ...(story && { story }),
      ...(tryCell && { tryCell, tryTerms }),
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
      try_row: fillTokens(copy.try_row, tokens),
      try_col: fillTokens(copy.try_col, tokens),
      try_done: copy.try_done,
      end: fillTokens(copy.end, tokens),
      ...billCaptions,
      ...captions,
    },
    beatMs: timedBeats(BEAT_MS, voice),
    voice,
    ...(tryCell && {
      waits: ['try_row', 'try_col'] as RowColBeat[],
      hints: {
        try_row: {
          caption: fillTokens(receipt.rowHint, { n: String(tryCell[0]) }),
          voice: 'bill.hint_row' as const,
        },
        try_col: {
          caption: fillTokens(receipt.colHint, { n: String(tryCell[1]) }),
          voice: 'bill.hint_col' as const,
        },
      },
    }),
    ...(studentAnswer && { compare: { studentAnswer, variant } }),
    purpose,
  };
}
