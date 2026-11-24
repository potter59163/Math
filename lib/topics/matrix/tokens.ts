import { th } from '@/lib/content/th';
import type { Answer, Matrix } from '@/lib/core/types';
import { surdText } from '@/lib/core/surd';
import type { TokenName, TokenOptions, TokenValues } from '@/lib/topics/types';
import { dimsLabel, rationalText, signed } from './format';
import { det, shape } from './ops';
import { firstWrongCell } from './scenes';
import type { FormId, MatrixItem } from './types';

// The values of the director's tokens for a matrix item (AI_DIRECTOR §4.4). The director reaches this
// through the pack, and the LLM never sees a number that did not come from here.

/**
 * A given anywhere else, but on these forms it is the question: `dim` asks for the dims of A, and
 * `index` for one cell of A. So it waits for the item to close too (AI_DIRECTOR §4.4).
 */
const THE_ANSWER_ON_FORM: Partial<Record<FormId, TokenName>> = { dim: 'dimsA', index: 'aCell' };

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
    case 'surd':
      return surdText(answer.value);
    case 'vector':
      return `(${answer.value.map(surdText).join(', ')})`;
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
export function resolveMatrixTokens(
  item: MatrixItem,
  answer: Answer | undefined,
  { revealAllowed }: TokenOptions,
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

  const heldBack = revealAllowed ? undefined : THE_ANSWER_ON_FORM[data.form];
  return Object.fromEntries(
    Object.entries(values).filter(([name, value]) => value !== undefined && name !== heldBack),
  ) as TokenValues;
}
