import { th } from '@/lib/content/th';
import type { Answer, Matrix } from '@/lib/core/types';
import { adjugate2, det2, inv2, mul } from '../ops';
import type { InverseBeat, InverseVariant, ScenePurpose, SceneSpecOf } from './types';

const BEAT_MS: Record<InverseBeat, number> = {
  show: 2000,
  swap: 2500,
  negate: 2500,
  det: 3000,
  divide: 3000,
  check: 3000,
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
    },
    beats: ['show', 'swap', 'negate', 'det', 'divide', ...(withCheck ? (['check'] as const) : [])],
    captions: {
      show: copy.show,
      swap: copy.swap,
      negate: copy.negate,
      det: copy.det,
      divide: copy.divide,
      check: copy.check,
      ...(flagged && { [flagged]: copy.compare[variant] }),
    },
    beatMs: BEAT_MS,
    ...(studentAnswer && { compare: { studentAnswer, variant } }),
    ...(flagged && { flagged }),
    purpose,
  };
}
