import { th } from '@/lib/content/th';
import { fillTokens } from '@/lib/core/tokens';
import type { Answer, Matrix } from '@/lib/core/types';
import { transpose } from '../ops';
import type { ScenePurpose, SceneSpecOf, TransposeBeat, TransposeVariant } from './types';
import { timedBeats, type VoiceId } from './voice';

const COMPARE_MS = 3000;
const SETUP_MS = 1800;
const ROW_MS = 2200;
const TRY_MS = 1000;
const DONE_MS = 1500;

const COMPARE_VOICE: Record<TransposeVariant, VoiceId> = {
  ROT_CW: 'flip.compare_turn',
  ROT_CCW: 'flip.compare_turn',
  ANTI: 'flip.compare_anti',
  FLIP_H: 'flip.compare_mirror',
  FLIP_V: 'flip.compare_mirror',
  SAME: 'flip.compare_same',
};

const ROW_VOICE: readonly VoiceId[] = ['flip.row_1', 'flip.row_2', 'flip.row_3'];

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
  // A student who got this wrong places the last row themselves, and then sees it move.
  const asking = variant !== undefined && rows.length > 1;
  const beats: TransposeBeat[] = [
    ...(variant ? (['compare'] as const) : []),
    'setup',
    ...rows.slice(0, -1),
    ...(asking ? (['try'] as const) : []),
    rows[rows.length - 1],
    'done',
  ];
  const voice: Partial<Record<TransposeBeat, VoiceId>> = {
    ...(variant && { compare: COMPARE_VOICE[variant] }),
    setup: 'flip.setup',
    ...Object.fromEntries(rows.map((beat, index) => [beat, ROW_VOICE[index]])),
    try: 'flip.try',
    done: 'flip.done',
  };
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
      ...(asking && { try: copy.try }),
      done: copy.done,
    },
    beatMs: timedBeats(
      {
        compare: COMPARE_MS,
        setup: SETUP_MS,
        ...Object.fromEntries(rows.map((beat) => [beat, ROW_MS])),
        try: TRY_MS,
        done: DONE_MS,
      },
      voice,
    ),
    voice,
    ...(asking && {
      waits: ['try'] as TransposeBeat[],
      hints: {
        try: {
          caption: fillTokens(copy.hint, { k: String(rows.length) }),
          voice: 'flip.hint' as const,
        },
      },
    }),
    ...(studentAnswer && { compare: { studentAnswer, variant } }),
    purpose,
  };
}
