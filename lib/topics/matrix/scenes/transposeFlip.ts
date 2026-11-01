import { th } from '@/lib/content/th';
import { fillTokens } from '@/lib/core/tokens';
import type { Answer, Matrix } from '@/lib/core/types';
import { transpose } from '../ops';
import type { ScenePurpose, SceneSpecOf, TransposeBeat, TransposeVariant } from './types';

const COMPARE_MS = 3000;
const SETUP_MS = 1500;
const ROW_MS = 2000;
const DONE_MS = 1500;

export interface TransposeInput {
  A: Matrix;
  variant?: TransposeVariant;
  student?: Matrix;
  studentAnswer?: Answer;
  purpose: ScenePurpose;
}

/** SCENES §4. One beat per row: row k becomes column k, on either side of the main diagonal. */
export function transposeScene({
  A,
  variant,
  student,
  studentAnswer,
  purpose,
}: TransposeInput): SceneSpecOf<'transpose_flip'> {
  const copy = th.scenes.transpose;
  const rows = A.map((_, index): TransposeBeat => `row_${index + 1}`);
  const beats: TransposeBeat[] = [
    ...(variant ? (['compare'] as const) : []),
    'setup',
    ...rows,
    'done',
  ];
  return {
    template: 'transpose_flip',
    params: {
      A,
      transposed: transpose(A),
      ...(variant && { variant }),
      ...(student && { student }),
    },
    beats,
    captions: {
      ...(variant && { compare: copy.compare[variant] }),
      setup: copy.setup,
      ...Object.fromEntries(
        rows.map((beat, index) => [beat, fillTokens(copy.row, { k: String(index + 1) })]),
      ),
      done: copy.done,
    },
    beatMs: {
      compare: COMPARE_MS,
      setup: SETUP_MS,
      ...Object.fromEntries(rows.map((beat) => [beat, ROW_MS])),
      done: DONE_MS,
    },
    ...(studentAnswer && { compare: { studentAnswer, variant } }),
    purpose,
  };
}
