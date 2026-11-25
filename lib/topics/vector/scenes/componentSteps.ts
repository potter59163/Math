import { thVector } from '@/lib/content/th.vector';
import { Rational } from '@/lib/core/rational';
import { fillTokens } from '@/lib/core/tokens';
import type { Answer } from '@/lib/core/types';
import { ijkText, linearExprText, signed } from '../format';
import { scale, sub } from '../ops';
import { linearVec } from '../solve';
import type { LinearTerm, MisconceptionId, Vec } from '../types';
import {
  answerText,
  beatsOf,
  choiceOf,
  factor,
  rationalText,
  scene,
  studentVector,
  sumText,
  vecText,
} from './build';
import type {
  ComponentBeat,
  ComponentMode,
  ScaledTerm,
  ScenePurpose,
  VectorSceneOf,
} from './types';
import type { VoiceId } from './voice';

const compBeat = (i: number): ComponentBeat => `comp_${i + 1}`;
const scaleBeat = (i: number): ComponentBeat => `scale_${i + 1}`;

const termName = ({ k, name }: Pick<LinearTerm, 'k' | 'name'>): string =>
  linearExprText([{ k, name }]);

export type ComponentInput =
  | { mode: 'points'; A: Vec; B: Vec; purpose: ScenePurpose; studentAnswer?: Answer }
  | {
      mode: 'linear';
      terms: LinearTerm[];
      notation: 'tuple' | 'ijk';
      purpose: ScenePurpose;
      studentAnswer?: Answer;
      caught?: MisconceptionId;
    };

/** VECTORS §5 `component_steps`: one component at a time, like `cell_by_cell` (SCENES §3.6). */
export function componentScene(input: ComponentInput): VectorSceneOf<'component_steps'> {
  return input.mode === 'points' ? pointsScene(input) : linearScene(input);
}

function pointsScene({
  A,
  B,
  purpose,
  studentAnswer,
}: Extract<ComponentInput, { mode: 'points' }>): VectorSceneOf<'component_steps'> {
  const copy = thVector.scenes.comp;
  const result = sub(B, A);
  const size = A.length as 2 | 3;
  const remedial = studentAnswer !== undefined;
  const lines = result.map(
    (part, i) => `${rationalText(B[i])} − ${factor(A[i])} = ${rationalText(part)}`,
  );
  const comps = result.map((_, i) => compBeat(i));
  const beats = beatsOf<ComponentBeat>(
    remedial && 'compare',
    remedial && 'try',
    purpose === 'intro' && size === 3 && 'axes',
    'setup',
    ...comps,
    'done',
  );
  const right = vecText(result);
  return scene({
    template: 'component_steps',
    params: {
      mode: 'points',
      size,
      A,
      B,
      expression: 'AB',
      result,
      lines,
      ...(studentVector(studentAnswer) && { student: studentVector(studentAnswer) }),
      ...(remedial && { try: choiceOf('B − A', ['A − B'], A[0].n + B[0].n) }),
    },
    beats,
    captions: {
      compare: fillTokens(copy.compare_points, {
        mine: studentAnswer ? answerText(studentAnswer) : '',
      }),
      try: copy.try_points,
      axes: copy.axes,
      setup: copy.setup_points,
      ...Object.fromEntries(
        comps.map((beat, i) => [beat, fillTokens(copy.comp, { i: String(i + 1), line: lines[i] })]),
      ),
      done: fillTokens(copy.done_points, { right }),
    },
    voice: {
      compare: 'v_comp.compare_points',
      try: 'v_comp.try_points',
      axes: 'v_comp.axes',
      setup: 'v_comp.setup_points',
      ...Object.fromEntries(
        comps.map((beat, i) => [beat, i === 0 ? 'v_comp.comp_1' : 'v_comp.comp_next']),
      ),
      done: 'v_comp.done',
    },
    ms: { setup: 3000, axes: 4000 },
    hint: { caption: copy.hint_points, voice: 'v_comp.hint_points' },
    studentAnswer,
    purpose,
  });
}

function linearScene({
  terms,
  notation,
  purpose,
  studentAnswer,
  caught,
}: Extract<ComponentInput, { mode: 'linear' }>): VectorSceneOf<'component_steps'> {
  const copy = thVector.scenes.comp;
  const result = linearVec(terms);
  const size = terms[0].vec.length as 2 | 3;
  const mode: ComponentMode = caught === 'V07_COMBO_SIGN' ? 'combo' : 'scale';
  const remedial = studentAnswer !== undefined;
  const scaled: ScaledTerm[] = terms.map(({ k, name, vec }) => {
    const value = scale(Rational.of(k), vec);
    return {
      k,
      name,
      vec,
      scaled: value,
      lines: vec.map((part, i) => `${signed(k)} · ${factor(part)} = ${rationalText(value[i])}`),
    };
  });
  const lines = result.map(
    (part, i) => `${sumText(scaled.map((t) => t.scaled[i]))} = ${rationalText(part)}`,
  );
  const scales = scaled.flatMap((t, i) => (t.k === 1 ? [] : [i]));
  // V07 asks how the subtracted term is written, just before it is.
  const asked = mode === 'combo' ? [...scales].reverse().find((i) => scaled[i].k < 0) : undefined;
  const scaleBeats = scales.flatMap((i) => [
    ...(remedial && asked === i ? (['try'] as const) : []),
    scaleBeat(i),
  ]);
  const read = notation === 'ijk';
  const expression = linearExprText(terms);
  const beats = beatsOf<ComponentBeat>(
    remedial && 'compare',
    remedial && mode === 'scale' && 'try',
    read ? 'read' : 'setup',
    ...scaleBeats,
    'sum',
    !remedial && 'done',
  );

  const question =
    mode === 'scale'
      ? choiceOf(copy.every, [copy.firstOnly], terms[0].vec[0].n)
      : asked !== undefined
        ? choiceOf(
            vecText(scaled[asked].scaled),
            [vecText(scale(Rational.of(-scaled[asked].k), scaled[asked].vec))],
            scaled[asked].vec[0].n,
          )
        : undefined;
  const plus = linearExprText(terms.map(({ k, name }) => ({ k: Math.abs(k), name })));
  const firstScale = scales[0];
  const scaleVoice = (i: number): VoiceId =>
    scaled[i].k < 0
      ? 'v_comp.scale_minus'
      : i === firstScale
        ? 'v_comp.scale_1'
        : 'v_comp.scale_next';

  return scene({
    template: 'component_steps',
    params: {
      mode,
      size,
      terms: scaled,
      expression,
      ...(read && { ijk: terms.map(({ name, vec }) => `${name} = ${ijkText(vec)}`) }),
      result,
      lines,
      ...(studentVector(studentAnswer) && { student: studentVector(studentAnswer) }),
      ...(remedial && question && { try: question }),
    },
    beats,
    captions: {
      compare: fillTokens(mode === 'combo' ? copy.compare_combo : copy.compare_scale, {
        mine: studentAnswer ? answerText(studentAnswer) : '',
        expr: expression,
        plus,
      }),
      try:
        mode === 'scale'
          ? copy.try_scale
          : fillTokens(copy.try_combo, {
              term: asked === undefined ? '' : termName(scaled[asked]),
            }),
      read: copy.read,
      setup: fillTokens(copy.setup_linear, { expr: expression }),
      ...Object.fromEntries(
        scales.map((i) => [
          scaleBeat(i),
          fillTokens(copy.scale, { term: termName(scaled[i]), k: signed(scaled[i].k) }),
        ]),
      ),
      sum: copy.sum,
      done: fillTokens(copy.done, { expr: expression, right: vecText(result) }),
    },
    voice: {
      compare: mode === 'combo' ? 'v_comp.compare_combo' : 'v_comp.compare_scale',
      try: mode === 'combo' ? 'v_comp.try_combo' : 'v_comp.try_scale',
      read: 'v_comp.read',
      setup: 'v_comp.setup_linear',
      ...Object.fromEntries(scales.map((i) => [scaleBeat(i), scaleVoice(i)])),
      sum: 'v_comp.sum',
      done: 'v_comp.done',
    },
    ms: { sum: 3500 },
    hint:
      mode === 'combo'
        ? { caption: copy.hint_combo, voice: 'v_comp.scale_minus' }
        : { caption: copy.hint_scale, voice: 'v_comp.hint_scale' },
    studentAnswer,
    purpose,
  });
}
