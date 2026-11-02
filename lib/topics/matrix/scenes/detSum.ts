import { th } from '@/lib/content/th';
import type { Rational } from '@/lib/core/rational';
import { fillTokens } from '@/lib/core/tokens';
import type { Answer, Matrix } from '@/lib/core/types';
import { rationalText } from '../format';
import { add, det2 } from '../ops';
import { choiceOf } from './tryChoice';
import type { DetSumBeat, ScenePurpose, SceneSpecOf } from './types';
import { timedBeats, type VoiceId } from './voice';

const COMPARE_MS = 4000;
const TRY_MS = 1000;
const ADD_MS = 3000;
const DET_MS = 3500;
const DIFFER_MS = 3000;

const VOICE: Partial<Record<DetSumBeat, VoiceId>> = {
  compare: 'sum.compare',
  try: 'sum.try',
  add_first: 'sum.add_first',
  det_of_sum: 'sum.det_of_sum',
  differ: 'sum.differ',
};

export interface DetSumInput {
  A: Matrix;
  B: Matrix;
  studentAnswer?: Answer;
  purpose: ScenePurpose;
}

/** With brackets around a negative second factor or term. */
function term(value: Rational): string {
  const text = rationalText(value);
  return value.sign() < 0 ? `(${text})` : text;
}

/** SCENES §3.7, for M15: the matrices add first, and det comes after. Always 2×2 on this form. */
export function detSumScene({ A, B, studentAnswer, purpose }: DetSumInput): SceneSpecOf<'det_sum'> {
  const copy = th.scenes.detSum;
  const sum = add(A, B);
  const [[a, b], [c, d]] = sum;
  const detA = det2(A);
  const detB = det2(B);
  const detSum = det2(sum);
  const wrong = detA.add(detB);
  return {
    template: 'det_sum',
    params: {
      A,
      B,
      sum,
      wrongLine: `det A + det B = ${rationalText(detA)} + ${term(detB)} = ${rationalText(wrong)}`,
      rightLine: `${term(a)} × ${term(d)} − ${term(b)} × ${term(c)} = ${rationalText(detSum)}`,
      detSum,
      wrong,
      try: choiceOf(copy.addFirst, [copy.detFirst], a.n + d.n),
    },
    beats: ['compare', 'try', 'add_first', 'det_of_sum', 'differ'],
    captions: {
      compare: copy.compare,
      try: copy.try,
      add_first: copy.add_first,
      det_of_sum: copy.det_of_sum,
      differ: fillTokens(copy.differ, {
        right: rationalText(detSum),
        wrong: rationalText(wrong),
      }),
    },
    beatMs: timedBeats(
      {
        compare: COMPARE_MS,
        try: TRY_MS,
        add_first: ADD_MS,
        det_of_sum: DET_MS,
        differ: DIFFER_MS,
      },
      VOICE,
    ),
    voice: VOICE,
    waits: ['try'],
    hints: { try: { caption: copy.hint, voice: 'sum.hint' } },
    flagged: 'compare',
    ...(studentAnswer && { compare: { studentAnswer } }),
    purpose,
  };
}
