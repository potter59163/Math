import { thVector } from '@/lib/content/th.vector';
import type { Rational } from '@/lib/core/rational';
import { fillTokens } from '@/lib/core/tokens';
import type { Answer } from '@/lib/core/types';
import { isUnknown, parallelAnswer, parallelK, parallelPair, partnerOf } from '../solve';
import type { DataOf, Slot, Vec } from '../types';
import { beatsOf, choiceOf, factor, rationalText, scene } from './build';
import type { ParallelBeat, ScenePurpose, VectorSceneOf } from './types';

export interface ParallelInput {
  data: DataOf<'parallel'>;
  purpose: ScenePurpose;
  studentAnswer?: Answer;
}

/** Every unknown put in from u = kv, so the check beat can show both vectors whole. */
function filled(u: readonly Slot[], v: readonly Slot[], k: Rational): { u: Vec; v: Vec } {
  return {
    u: u.map((part, i) => (isUnknown(part) ? k.mul(v[i] as Rational) : part)),
    v: v.map((part, i) => (isUnknown(part) ? (u[i] as Rational).div(k) : part)),
  };
}

/** VECTORS §5 `parallel_scale`: u = kv stretches or turns v round, k from the known pair (V08). */
export function parallelScene({
  data,
  purpose,
  studentAnswer,
}: ParallelInput): VectorSceneOf<'parallel_scale'> {
  const copy = thVector.scenes.par;
  const { u, v, ask } = data;
  const k = parallelK(data);
  const pair = parallelPair(u, v)!;
  const { at, partner } = partnerOf(data);
  const answer = parallelAnswer(data);
  const inU = at.vector === 'u';
  const student =
    studentAnswer?.kind === 'scalar' && !studentAnswer.value.equals(answer)
      ? studentAnswer.value
      : undefined;
  const remedial = student !== undefined;
  const whole = filled(u, v, k);

  const kLine = `${rationalText(u[pair] as Rational)} = k · ${factor(v[pair] as Rational)}  →  k = ${rationalText(k)}`;
  const solveLine = inU
    ? `${ask} = ${factor(k)} · ${factor(partner)} = ${rationalText(answer)}`
    : `${ask} = ${rationalText(partner)} ÷ ${factor(k)} = ${rationalText(answer)}`;
  const wrongLine =
    student &&
    (inU
      ? `${ask} = ${rationalText(partner)} ÷ ${factor(k)} = ${rationalText(student)}`
      : `${ask} = ${factor(k)} · ${factor(partner)} = ${rationalText(student)}`);

  const beats = beatsOf<ParallelBeat>(
    remedial && 'compare',
    'setup',
    'stretch',
    'find_k',
    remedial && 'try',
    'solve',
    remedial && 'end',
  );
  return scene({
    template: 'parallel_scale',
    params: {
      u,
      v,
      ask,
      k,
      pair,
      unknown: at,
      kLine,
      solveLine,
      answer,
      uFilled: whole.u,
      vFilled: whole.v,
      ...(student && { student, wrongLine }),
      ...(student && {
        try: choiceOf(rationalText(answer), [rationalText(student)], answer.n + student.n),
      }),
    },
    beats,
    captions: {
      compare: fillTokens(copy.compare, {
        mine: student ? rationalText(student) : '',
        x: ask,
      }),
      setup: copy.setup,
      stretch: k.sign() < 0 ? copy.stretch_back : copy.stretch,
      find_k: fillTokens(copy.find_k, { line: kLine }),
      try: fillTokens(copy.try, { x: ask }),
      solve: fillTokens(inU ? copy.solve_times : copy.solve_divide, { x: ask, line: solveLine }),
      end: copy.end,
    },
    voice: {
      compare: 'v_par.compare',
      setup: 'v_par.setup',
      stretch: 'v_par.stretch',
      find_k: 'v_par.find_k',
      try: 'v_par.try',
      solve: 'v_par.solve',
      end: 'v_par.end',
    },
    ms: { stretch: 3500, find_k: 3500, solve: 3500 },
    hint: { caption: copy.hint, voice: 'v_par.hint' },
    studentAnswer: remedial ? studentAnswer : undefined,
    purpose,
  });
}
