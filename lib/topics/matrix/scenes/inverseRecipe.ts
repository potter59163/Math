import { th } from '@/lib/content/th';
import type { Answer, Matrix } from '@/lib/core/types';
import { adjugate2, det2, inv2, mul } from '../ops';
import { choiceOf } from './tryChoice';
import type { InverseBeat, InverseVariant, ScenePurpose, SceneSpecOf } from './types';
import { timedBeats, type VoiceId } from './voice';

const BEAT_MS: Record<InverseBeat, number> = {
  show: 2000,
  swap: 2500,
  negate: 2500,
  det: 3000,
  divide: 3000,
  check: 3000,
  try: 1000,
  try_done: 2000,
};

/** The beat each slip skipped or got wrong (SCENES §3.4). */
const FLAGGED: Record<InverseVariant, InverseBeat> = {
  NO_SWAP: 'swap',
  NO_NEGATE: 'negate',
  NO_DIVIDE: 'divide',
  TIMES_DET: 'divide',
  TRANSPOSED: 'negate',
  RECIPROCAL: 'show',
};

type RecipeStep = keyof typeof th.scenes.inverse.steps;

export interface InverseInput {
  A: Matrix;
  variant?: InverseVariant;
  student?: Matrix;
  studentAnswer?: Answer;
  /** The optional last beat: A·A⁻¹ = I. */
  withCheck?: boolean;
  purpose: ScenePurpose;
}

export function inverseScene({
  A,
  variant,
  student,
  studentAnswer,
  withCheck = false,
  purpose,
}: InverseInput): SceneSpecOf<'inverse_recipe'> {
  const copy = th.scenes.inverse;
  const [[a, b], [c, d]] = A;
  const inverse = inv2(A);
  const flagged = variant && FLAGGED[variant];
  // Mixing up the whole idea of an inverse is not one forgotten step of the three.
  const missed = flagged && flagged !== 'show' ? (flagged as RecipeStep) : undefined;
  const question = missed
    ? choiceOf(
        copy.steps[missed],
        (Object.keys(copy.steps) as RecipeStep[])
          .filter((step) => step !== missed)
          .map((step) => copy.steps[step]),
        a.n + d.n,
      )
    : undefined;
  const voice: Partial<Record<InverseBeat, VoiceId>> = {
    show: 'recipe.show',
    swap: 'recipe.swap',
    negate: 'recipe.negate',
    det: 'recipe.det',
    divide: 'recipe.divide',
    try: 'recipe.try',
    try_done: 'recipe.try_done',
    ...(flagged && { [flagged]: `recipe.compare_${variant}` as const }),
  };
  return {
    template: 'inverse_recipe',
    params: {
      A,
      swapped: [
        [d, b],
        [c, a],
      ],
      adjugate: adjugate2(A),
      ad: a.mul(d),
      bc: b.mul(c),
      det: det2(A),
      inverse,
      identity: mul(A, inverse),
      ...(variant && { variant }),
      ...(student && { student }),
      ...(question && { try: question }),
    },
    beats: [
      'show',
      'swap',
      'negate',
      'det',
      'divide',
      ...(withCheck ? (['check'] as const) : []),
      ...(question ? (['try', 'try_done'] as const) : []),
    ],
    captions: {
      show: copy.show,
      swap: copy.swap,
      negate: copy.negate,
      det: copy.det,
      divide: copy.divide,
      check: copy.check,
      ...(flagged && { [flagged]: copy.compare[variant] }),
      ...(question && { try: copy.try, try_done: copy.try_done }),
    },
    beatMs: timedBeats(BEAT_MS, voice),
    voice,
    ...(question && {
      waits: ['try'] as InverseBeat[],
      hints: { try: { caption: copy.hint, voice: 'recipe.hint' as const } },
    }),
    ...(studentAnswer && { compare: { studentAnswer, variant } }),
    ...(flagged && { flagged }),
    purpose,
  };
}
