import { thVector } from '@/lib/content/th.vector';
import { Rational } from '@/lib/core/rational';
import { fillTokens } from '@/lib/core/tokens';
import type { Answer } from '@/lib/core/types';
import { cross } from '../ops';
import { crossFactors } from '../solve';
import type { DataOf, MisconceptionId, Vec } from '../types';
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
import type { CrossBeat, CrossMistake, ScenePurpose, VectorSceneOf } from './types';
import type { VoiceId } from './voice';

export interface CrossInput {
  data: DataOf<'cross'>;
  purpose: ScenePurpose;
  studentAnswer?: Answer;
  caught?: MisconceptionId;
}

const MISTAKES: Partial<Record<MisconceptionId, CrossMistake>> = {
  V20_CROSS_MIDDLE_SIGN: 'middle_sign',
  V21_CROSS_ORDER: 'order',
  V22_CROSS_COMPONENTWISE: 'componentwise',
};

const COMPARE_VOICE: Record<CrossMistake, VoiceId> = {
  middle_sign: 'v_cross.compare_sign',
  order: 'v_cross.compare_order',
  componentwise: 'v_cross.compare_each',
};

/** a₂b₃ − a₃b₂, −(a₁b₃ − a₃b₁), a₁b₂ − a₂b₁ with the numbers in, as each covered column reads. */
export function crossLines(a: Vec, b: Vec): string[] {
  const c = cross(a, b);
  const minor = (p: number, q: number) =>
    `${factor(a[p])}·${factor(b[q])} − ${factor(a[q])}·${factor(b[p])}`;
  return [
    `${minor(1, 2)} = ${rationalText(c[0])}`,
    `−(${minor(0, 2)}) = ${rationalText(c[1])}`,
    `${minor(0, 1)} = ${rationalText(c[2])}`,
  ];
}

/** c · a written out, which is 0 when c is a × b. */
export function dotLine(c: readonly Rational[], a: Vec): string {
  const products = c.map((part, i) => part.mul(a[i]));
  const total = products.reduce((sum, value) => sum.add(value), Rational.ZERO);
  return `${sumText(products)} = ${rationalText(total)}`;
}

/** VECTORS §5 `cross_cover`: the i j k table, one column covered at a time, signs + − +. */
export function crossScene({
  data,
  purpose,
  studentAnswer,
  caught,
}: CrossInput): VectorSceneOf<'cross_cover'> {
  const copy = thVector.scenes.cross;
  const [first, second] = crossFactors(data);
  const names: [string, string] = data.order === 'uv' ? ['u', 'v'] : ['v', 'u'];
  const result = cross(first, second);
  const flipped = cross(second, first);
  const mistake = caught ? MISTAKES[caught] : undefined;
  const remedial = studentAnswer !== undefined && mistake !== undefined;
  const intro = purpose === 'intro';
  const student = studentVector(studentAnswer);
  const studentRational = student?.every((part) => part.isRational())
    ? student.map((part) => part.toRational())
    : undefined;
  const product = `${names[0]} × ${names[1]}`;
  const reverse = `${names[1]} × ${names[0]}`;

  const beats = beatsOf<CrossBeat>(
    remedial && 'compare',
    intro && 'setup',
    !remedial && !intro && 'setup',
    'cover_i',
    remedial && mistake === 'middle_sign' && 'try',
    'cover_j',
    'cover_k',
    intro && 'result',
    (!remedial || mistake !== 'order') && 'check',
    (intro || mistake === 'order') && 'flip',
    remedial && mistake !== 'middle_sign' && 'try',
    (remedial || intro) && 'end',
  );
  const question =
    mistake === 'middle_sign'
      ? choiceOf('−', ['+'], first[0].n)
      : mistake === 'order'
        ? choiceOf(`${reverse} = −(${product})`, [`${reverse} = ${product}`], first[1].n)
        : choiceOf(copy.bothPerp, [copy.bothParallel], first[2].n);
  const tryCaption =
    mistake === 'middle_sign'
      ? copy.try_sign
      : mistake === 'order'
        ? fillTokens(copy.try_order, { reverse })
        : copy.try_each;
  const hints: Record<CrossMistake, { caption: string; voice: VoiceId }> = {
    middle_sign: { caption: copy.hint_sign, voice: 'v_cross.hint_sign' },
    order: { caption: copy.hint_order, voice: 'v_cross.flip' },
    componentwise: { caption: copy.hint_each, voice: 'v_cross.hint_each' },
  };

  return scene({
    template: 'cross_cover',
    params: {
      first,
      second,
      names,
      lines: crossLines(first, second),
      result,
      checkLines: [
        `(${product}) · ${names[0]} = ${dotLine(result, first)}`,
        `(${product}) · ${names[1]} = ${dotLine(result, second)}`,
      ],
      flipped,
      ...(mistake && remedial && { mistake }),
      ...(student && { student }),
      ...(mistake === 'componentwise' &&
        studentRational && { studentCheck: dotLine(studentRational, first) }),
      ...(remedial && { try: question }),
    },
    beats,
    captions: {
      compare: fillTokens(
        mistake === 'order'
          ? copy.compare_order
          : mistake === 'componentwise'
            ? copy.compare_each
            : copy.compare_sign,
        { mine: studentAnswer ? answerText(studentAnswer) : '', product, reverse },
      ),
      setup: intro ? copy.intro_setup : fillTokens(copy.setup, { product }),
      cover_i: fillTokens(copy.cover_i, { line: crossLines(first, second)[0] }),
      cover_j: fillTokens(copy.cover_j, { line: crossLines(first, second)[1] }),
      cover_k: fillTokens(copy.cover_k, { line: crossLines(first, second)[2] }),
      result: fillTokens(copy.result, { product, right: vecText(result) }),
      check: fillTokens(copy.check, { product }),
      flip: fillTokens(copy.flip, { product, reverse }),
      try: tryCaption,
      end: copy.end,
    },
    voice: {
      compare: mistake ? COMPARE_VOICE[mistake] : 'v_cross.compare_sign',
      setup: intro ? 'v_cross.intro_setup' : 'v_cross.setup',
      cover_i: 'v_cross.cover_i',
      cover_j: 'v_cross.cover_j',
      cover_k: 'v_cross.cover_k',
      result: 'v_cross.result',
      check: 'v_cross.check',
      flip: 'v_cross.flip',
      try:
        mistake === 'middle_sign'
          ? 'v_cross.try_sign'
          : mistake === 'order'
            ? 'v_cross.try_order'
            : 'v_cross.try_each',
      end: 'v_cross.end',
    },
    ms: { cover_i: 3000, cover_j: 3000, cover_k: 3000, check: 3500 },
    hint: hints[mistake ?? 'middle_sign'],
    studentAnswer: remedial ? studentAnswer : undefined,
    purpose,
  });
}
