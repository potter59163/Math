import { th } from '@/lib/content/th';
import { fillTokens, tokensIn } from '@/lib/core/tokens';
import type { Answer, Matrix } from '@/lib/core/types';
import { dimsLabel, rationalText, signed } from '@/lib/topics/matrix/format';
import { det, shape } from '@/lib/topics/matrix/ops';
import { firstWrongCell } from '@/lib/topics/matrix/scenes';
import type { MatrixItem } from '@/lib/topics/matrix/types';

// Numbers reach a student's text only through these tokens (AI_DIRECTOR §4.4). The LLM writes the
// token, and this fills it with the engine's value.

export type TokenName =
  | 'i'
  | 'j'
  | 'dimsA'
  | 'dimsB'
  | 'aCell'
  | 'bCell'
  | 'studentCell'
  | 'studentAnswer'
  | 'k'
  | 'correctCell'
  | 'correctAnswer'
  | 'det';

export const REVEALING_TOKENS: readonly TokenName[] = ['correctCell', 'correctAnswer', 'det'];

export type TokenValues = Partial<Record<TokenName, string>>;

interface Options {
  /** True only after the item is closed (AI_DIRECTOR §2). */
  revealAllowed: boolean;
}

const NO_DIFFERENCE = -1;

/** With no answer yet: where the first diagnostic (the target) differs most from the right answer. */
function widestGap(item: MatrixItem): [number, number] {
  const { correct } = item;
  if (correct.kind !== 'matrix') return [1, 1];
  const found = item.diagnostics.find(
    ({ answer }) =>
      answer.kind === 'matrix' &&
      answer.value.length === correct.value.length &&
      answer.value[0].length === correct.value[0].length,
  );
  if (found?.answer.kind !== 'matrix') return [1, 1];
  let best: [number, number] = [1, 1];
  let widest = NO_DIFFERENCE;
  found.answer.value.forEach((row, i) => {
    row.forEach((cell, j) => {
      const gap = cell.sub(correct.value[i][j]).abs();
      const size = gap.n / gap.d;
      if (size > widest) {
        widest = size;
        best = [i + 1, j + 1];
      }
    });
  });
  return best;
}

/** The cell the text talks about: the one a scene focuses on, so words and picture agree. */
function focusCell(item: MatrixItem, answer: Answer | undefined): [number, number] | null {
  const { data, correct } = item;
  if (data.form === 'index') return [data.i, data.j];
  if (correct.kind !== 'matrix') return null;
  return answer ? firstWrongCell(answer, correct) : widestGap(item);
}

function matrixText(value: Matrix): string {
  const rows = value.map((row) => row.map(rationalText).join(', '));
  return `[${rows.join('; ')}]`;
}

function answerText(item: MatrixItem, answer: Answer): string {
  switch (answer.kind) {
    case 'matrix':
      return matrixText(answer.value);
    case 'scalar':
      return rationalText(answer.value);
    case 'dims':
      return dimsLabel(answer);
    case 'undefined':
      return th.session.undefined;
    case 'choice': {
      const option = item.options?.find(({ id }) => id === answer.id);
      return option ? th.choices[option.labelKey] : answer.id;
    }
  }
}

function cellText(value: Matrix | undefined, [i, j]: [number, number]): string | undefined {
  const cell = value?.[i - 1]?.[j - 1];
  return cell && rationalText(cell);
}

function detOf(item: MatrixItem): string | undefined {
  const { data } = item;
  switch (data.form) {
    case 'det2':
    case 'det3':
    case 'inv2':
    case 'invertible':
      return rationalText(det(data.A));
    default:
      return undefined;
  }
}

/** The values for this item and answer. A token with no meaning here has no value. */
export function resolveTokens(
  item: MatrixItem,
  answer: Answer | undefined,
  { revealAllowed }: Options,
): TokenValues {
  const { data, correct } = item;
  const a = 'A' in data ? data.A : undefined;
  const b = 'B' in data ? data.B : undefined;
  const focus = focusCell(item, answer);
  const values: TokenValues = {};

  if (focus) {
    values.i = String(focus[0]);
    values.j = String(focus[1]);
    values.aCell = cellText(a, focus);
    values.bCell = cellText(b, focus);
    if (answer?.kind === 'matrix') values.studentCell = cellText(answer.value, focus);
    if (revealAllowed && correct.kind === 'matrix') {
      values.correctCell = cellText(correct.value, focus);
    }
  }
  if (a) values.dimsA = dimsLabel(shape(a));
  if (b) values.dimsB = dimsLabel(shape(b));
  if ('dimsA' in data) {
    values.dimsA = dimsLabel(data.dimsA);
    values.dimsB = dimsLabel(data.dimsB);
  }
  if ('k' in data) values.k = signed(data.k);
  if (answer) values.studentAnswer = answerText(item, answer);
  if (revealAllowed) {
    values.correctAnswer = answerText(item, correct);
    values.det = detOf(item);
  }

  return Object.fromEntries(
    Object.entries(values).filter(([, value]) => value !== undefined),
  ) as TokenValues;
}

/** `allowedTokens` of AI_DIRECTOR §4.1. */
export function allowedTokens(
  item: MatrixItem,
  answer: Answer | undefined,
  options: Options,
): TokenName[] {
  return Object.keys(resolveTokens(item, answer, options)) as TokenName[];
}

/** Fills student-facing text. A token that is not allowed here throws, so it can never get through. */
export function fillStudentText(
  text: string,
  item: MatrixItem,
  answer: Answer | undefined,
  options: Options,
): string {
  const values = resolveTokens(item, answer, options);
  const missing = tokensIn(text).filter((token) => !(token in values));
  if (missing.length > 0) throw new Error(`fillStudentText: no value for ${missing.join(', ')}`);
  return fillTokens(text, values);
}
