import { th } from '@/lib/content/th';
import type { Rational } from '@/lib/core/rational';
import { fillTokens } from '@/lib/core/tokens';
import type { Matrix } from '@/lib/core/types';
import type { ThemeId } from '@/lib/learner/types';
import { rationalText } from '../format';
import { mul, sum } from '../ops';
import type { PairTerm } from './types';

// A clip that says why multiplying cell by cell cannot be right, with this student's own numbers: a row
// of A is how many, a column of B is how much, and their one multiplication was one line of the receipt.
// Every number is worked out here by the engine, and the drawing only places what it is given.

export const RECEIPT_BEATS = [
  'caught',
  'did',
  'quantities',
  'prices',
  'only_first',
  'all_lines',
  'answer',
  'rule',
  'try_row',
  'try_col',
  'try_done',
  'end',
] as const;

export type ReceiptBeat = (typeof RECEIPT_BEATS)[number];

/** These wait for the student to tap instead of for the clock. */
export const WAITING_BEATS: readonly ReceiptBeat[] = ['try_row', 'try_col'];

/** Long enough to read the caption and watch what moves, at about 12 Thai characters a second. */
const BEAT_MS: Partial<Record<ReceiptBeat, number>> = {
  caught: 3400,
  did: 3400,
  quantities: 4200,
  prices: 3400,
  only_first: 4600,
  all_lines: 3600,
  answer: 3200,
  rule: 3400,
  try_done: 4000,
};

export interface ReceiptLine {
  item: string;
  qty: Rational;
  price: Rational;
  amount: Rational;
}

export interface ReceiptClip {
  left: Matrix;
  right: Matrix;
  product: Matrix;
  student: Matrix;
  /** 0-based. The cell the story is told on. */
  focus: [row: number, col: number];
  /** 0-based. The cell the student works out for themselves. */
  tryCell: [row: number, col: number];
  who: string;
  labels: { qty: string; price: string; result: string };
  lines: ReceiptLine[];
  total: Rational;
  /** Which line was the one multiplication the student did. */
  theirLine: number;
  tryTerms: PairTerm[];
  tryTotal: Rational;
  beatMs: Partial<Record<ReceiptBeat, number>>;
  captions: Record<ReceiptBeat, string>;
  hints: { row: string; col: string };
}

export interface ReceiptInput {
  left: Matrix;
  right: Matrix;
  student: Matrix;
  theme: ThemeId;
}

const countable = (value: Rational) => value.isInteger() && value.sign() >= 0;

/** A cell other than the focus, in another row if one was wrong there, since that shows the most. */
function cellToTry(student: Matrix, product: Matrix, [row, col]: [number, number]) {
  const others = product.flatMap((cells, i) =>
    cells.map((_, j) => [i, j] as [number, number]).filter(([, j]) => i !== row || j !== col),
  );
  const wrong = ([i, j]: [number, number]) => !student[i][j].equals(product[i][j]);
  return (
    others.find((cell) => wrong(cell) && cell[0] !== row && cell[1] === col) ??
    others.find(wrong) ??
    others[0]
  );
}

/**
 * Null when this story cannot be told honestly, and then the student gets the ordinary clip. A negative
 * or a fraction is not a number of swords. And only on the diagonal is "the same position" a line of the
 * receipt at all: a cell at row i and column j there is A[i][j] × B[j][j], not A[i][j] × B[i][j].
 */
export function receiptClip({ left, right, student, theme }: ReceiptInput): ReceiptClip | null {
  const product = mul(left, right);
  const story = th.scenes.intro.stories[theme];
  const count = left[0].length;
  if (count > story.labels.cols.length || product.length !== product[0].length) return null;

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
  const col = row;

  const lines = left[row].map((qty, k) => {
    const price = right[k][col];
    return { item: story.labels.cols[k], qty, price, amount: qty.mul(price) };
  });
  const total = sum(lines.map(({ amount }) => amount));
  const [tryRow, tryCol] = cellToTry(student, product, [row, col]);
  const tryTerms = left[tryRow].map((a, k) => {
    const b = right[k][tryCol];
    return { a, b, product: a.mul(b) };
  });

  const copy = th.clip.receipt;
  const tokens = {
    mine: rationalText(student[row][col]),
    right: rationalText(product[row][col]),
    a: rationalText(left[row][col]),
    b: rationalText(right[row][col]),
    who: story.labels.rows[row],
    qty: story.u3.left,
    price: story.u3.right,
    theirs: lines[row].item,
    other: lines[(row + 1) % lines.length].item,
  };
  const captions = Object.fromEntries(
    RECEIPT_BEATS.map((beat) => [beat, fillTokens(copy.captions[beat], tokens)]),
  ) as Record<ReceiptBeat, string>;

  return {
    left,
    right,
    product,
    student,
    focus: [row, col],
    tryCell: [tryRow, tryCol],
    who: story.labels.rows[row],
    labels: { qty: story.u3.left, price: story.u3.right, result: story.u3.result },
    lines,
    total,
    theirLine: row,
    tryTerms,
    tryTotal: sum(tryTerms.map(({ product: value }) => value)),
    beatMs: BEAT_MS,
    captions,
    hints: {
      row: fillTokens(copy.rowHint, { n: String(tryRow + 1) }),
      col: fillTokens(copy.colHint, { n: String(tryCol + 1) }),
    },
  };
}
