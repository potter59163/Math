import { thVector } from '@/lib/content/th.vector';
import { Rational } from '@/lib/core/rational';
import { Surd, surdText } from '@/lib/core/surd';
import { fillTokens } from '@/lib/core/tokens';
import type { Answer } from '@/lib/core/types';
import { cosOf, det2, dot, dotTerms, sinOf } from '../ops';
import { isUnknown, perpAnswer, unknownAt } from '../solve';
import type { DataOf, MisconceptionId, Slot, Vec } from '../types';
import {
  answerText,
  beatsOf,
  choiceOf,
  factor,
  rationalText,
  scene,
  sumText,
  surdFactor,
} from './build';
import type { DotBeat, DotPairsParams, ScenePurpose, VectorSceneOf } from './types';
import type { VoiceId } from './voice';

const signOf = (value: Rational): NonNullable<DotPairsParams['sign']> =>
  value.isZero() ? 'right' : value.sign() > 0 ? 'acute' : 'obtuse';

const SIGN_VOICE: Record<NonNullable<DotPairsParams['sign']>, VoiceId> = {
  acute: 'v_dot.sign_acute',
  right: 'v_dot.sign_right',
  obtuse: 'v_dot.sign_obtuse',
};

/** 1·(−1) + 1·0, the products a dot product adds, written out. */
export function productsText(u: readonly Rational[], v: readonly Rational[]): string {
  return u.map((part, i) => `${factor(part)}·${factor(v[i])}`).join(' + ');
}

export type DotInput =
  | { data: DataOf<'dot'>; purpose: ScenePurpose; studentAnswer?: Answer }
  | {
      data: DataOf<'dot_polar'>;
      purpose: ScenePurpose;
      studentAnswer?: Answer;
      caught?: MisconceptionId;
    }
  | { data: DataOf<'perp'>; purpose: ScenePurpose; studentAnswer?: Answer };

/** VECTORS §5 `dot_pairs`: match the places, multiply, add; the sign tells the angle. */
export function dotScene(input: DotInput): VectorSceneOf<'dot_pairs'> {
  switch (input.data.form) {
    case 'dot':
      return pairsScene({ ...input, data: input.data });
    case 'dot_polar':
      return polarScene({ ...(input as Extract<DotInput, { data: DataOf<'dot_polar'> }>) });
    case 'perp':
      return perpScene({ ...input, data: input.data });
  }
}

function pairsScene({
  data,
  purpose,
  studentAnswer,
}: {
  data: DataOf<'dot'>;
  purpose: ScenePurpose;
  studentAnswer?: Answer;
}): VectorSceneOf<'dot_pairs'> {
  const copy = thVector.scenes.dot;
  const { u, v } = data;
  const terms = dotTerms(u, v);
  const value = dot(u, v);
  const remedial = studentAnswer !== undefined;
  const intro = purpose === 'intro';
  const flat = u.length === 2;
  const right = productsText(u, v);
  const wrong = flat
    ? `${factor(u[0])}·${factor(v[1])} − ${factor(u[1])}·${factor(v[0])}`
    : undefined;
  const beats = beatsOf<DotBeat>(
    remedial && 'compare',
    remedial && 'try',
    intro && 'setup',
    intro && 'picture',
    !remedial && !intro && 'setup',
    'pair',
    'multiply',
    'sum',
    'sign',
    (remedial || intro) && 'end',
  );
  const student = studentAnswer && answerText(studentAnswer);
  return scene({
    template: 'dot_pairs',
    params: {
      mode: 'pairs',
      u,
      v,
      uFilled: u,
      vFilled: v,
      products: terms.map(
        (product, i) => `${factor(u[i])} · ${factor(v[i])} = ${rationalText(product)}`,
      ),
      sumLine: `u · v = ${sumText(terms)} = ${rationalText(value)}`,
      value: Surd.rational(value),
      sign: signOf(value),
      ...(wrong && { wrongLine: `${wrong} = ${rationalText(det2(u, v))}` }),
      ...(student && { student }),
      ...(remedial && wrong && { try: choiceOf(right, [wrong], u[0].n + v[0].n) }),
    },
    beats,
    captions: {
      compare: fillTokens(copy.compare_det, { mine: student ?? '' }),
      try: copy.try_pairs,
      setup: intro ? copy.intro_setup : copy.setup,
      picture: copy.picture,
      pair: copy.pair,
      multiply: copy.multiply,
      sum: fillTokens(copy.sum, { value: rationalText(value) }),
      sign: copy[`sign_${signOf(value)}`],
      end: copy.end,
    },
    voice: {
      compare: 'v_dot.compare_det',
      try: 'v_dot.try_pairs',
      setup: intro ? 'v_dot.intro_setup' : 'v_dot.setup',
      picture: 'v_dot.picture',
      pair: 'v_dot.pair',
      multiply: 'v_dot.multiply',
      sum: 'v_dot.sum',
      sign: SIGN_VOICE[signOf(value)],
      end: 'v_dot.end',
    },
    ms: { pair: 3000, multiply: 3000, sign: 3500 },
    hint: { caption: copy.hint_pairs, voice: 'v_dot.hint_pairs' },
    studentAnswer,
    purpose,
  });
}

function polarScene({
  data,
  purpose,
  studentAnswer,
  caught,
}: {
  data: DataOf<'dot_polar'>;
  purpose: ScenePurpose;
  studentAnswer?: Answer;
  caught?: MisconceptionId;
}): VectorSceneOf<'dot_pairs'> {
  const copy = thVector.scenes.dot;
  const { normU, normV, theta } = data;
  const cos = cosOf(theta);
  const value = normU.mul(normV).mul(cos);
  const remedial = studentAnswer !== undefined;
  const sine = caught === 'V16_DOT_SIN';
  const both = `${surdText(normU)} · ${surdFactor(normV)}`;
  const wrongLine = sine
    ? `${both} · sin ${theta}° = ${surdText(normU.mul(normV).mul(sinOf(theta)))}`
    : `${both} = ${surdText(normU.mul(normV))}`;
  const beats = beatsOf<DotBeat>(
    remedial && 'compare',
    'picture',
    remedial && 'try',
    'formula',
    'cos',
    'sum',
    'end',
  );
  const student = studentAnswer && answerText(studentAnswer);
  const rightForm = '|u||v| cos θ';
  return scene({
    template: 'dot_pairs',
    params: {
      mode: 'angle',
      normU,
      normV,
      theta,
      cos,
      cosLine: `cos ${theta}° = ${surdText(cos)}`,
      sumLine: `u · v = ${both} · ${surdFactor(cos)} = ${surdText(value)}`,
      value,
      sign: signOf(dotSign(value)),
      ...(remedial && { wrongLine }),
      ...(student && { student }),
      ...(remedial && {
        try: choiceOf(rightForm, [sine ? '|u||v| sin θ' : '|u||v|'], theta),
      }),
    },
    beats,
    captions: {
      compare: fillTokens(sine ? copy.compare_sin : copy.compare_cos, { mine: student ?? '' }),
      picture: fillTokens(copy.polar_picture, {
        u: surdText(normU),
        v: surdText(normV),
        theta: String(theta),
      }),
      try: copy.try_polar,
      formula: copy.formula,
      cos: fillTokens(copy.cos, { line: `cos ${theta}° = ${surdText(cos)}` }),
      sum: fillTokens(copy.polar_sum, { value: surdText(value) }),
      end: copy.end_polar,
    },
    voice: {
      compare: sine ? 'v_dot.compare_sin' : 'v_dot.compare_cos',
      picture: 'v_dot.picture',
      try: 'v_dot.try_polar',
      formula: 'v_dot.formula',
      cos: 'v_dot.cos',
      sum: 'v_dot.polar_multiply',
      end: 'v_dot.end_polar',
    },
    ms: { formula: 3500, sum: 3500 },
    hint: { caption: copy.hint_polar, voice: 'v_dot.end_polar' },
    studentAnswer,
    purpose,
  });
}

/** The sign of a surd, as a rational with that sign. */
const dotSign = (value: Surd): Rational => Rational.of(value.sign());

/** "k", "−k" or "3k": k times a known coefficient. */
function kTimes(coefficient: Rational): string {
  if (coefficient.equals(Rational.ONE)) return 'k';
  if (coefficient.equals(Rational.ONE.neg())) return '−k';
  return `${rationalText(coefficient)}k`;
}

function perpScene({
  data,
  purpose,
  studentAnswer,
}: {
  data: DataOf<'perp'>;
  purpose: ScenePurpose;
  studentAnswer?: Answer;
}): VectorSceneOf<'dot_pairs'> {
  const copy = thVector.scenes.dot;
  const { u, v } = data;
  const at = unknownAt(u, v, 'k')!;
  const [own, other] = at.vector === 'u' ? [u, v] : [v, u];
  const answer = perpAnswer(data);
  const put = (slots: readonly Slot[]): Vec =>
    slots.map((part) => (isUnknown(part) ? answer : part));
  const coefficient = other[at.index] as Rational;
  const known = own.flatMap((part, i) =>
    i === at.index ? [] : [(part as Rational).mul(other[i] as Rational)],
  );
  const rest = known.reduce((total, value) => total.add(value), Rational.ZERO);
  const products = own.map((part, i) => {
    const across = other[i] as Rational;
    if (isUnknown(part)) return `k · ${factor(across)} = ${kTimes(across)}`;
    const [a, b] = at.vector === 'u' ? [part, across] : [across, part];
    return `${factor(a)} · ${factor(b)} = ${rationalText(a.mul(b))}`;
  });
  const pieces = own.map((part, i) =>
    isUnknown(part)
      ? kTimes(coefficient)
      : rationalText((part as Rational).mul(other[i] as Rational)),
  );
  const equationLine = `${pieces.map((p, i) => (i > 0 && p.startsWith('−') ? `(${p})` : p)).join(' + ')} = 0`;
  const solveLine = `${kTimes(coefficient)} = ${rationalText(rest.neg())}  →  k = ${rationalText(answer)}`;

  const student =
    studentAnswer?.kind === 'scalar' && !studentAnswer.value.equals(answer)
      ? studentAnswer.value
      : undefined;
  const remedial = student !== undefined;
  // V19 sets the first other given pair in ratio with the pair holding k: own_i / other_i = k / partner.
  const ratioAt = own.findIndex(
    (part, i) => i !== at.index && !isUnknown(part) && !(other[i] as Rational).isZero(),
  );
  const wrongLine =
    student && ratioAt >= 0
      ? `${rationalText(own[ratioAt] as Rational)}/${factor(other[ratioAt] as Rational)} = k/${factor(coefficient)}  →  k = ${rationalText(student)}`
      : undefined;
  const beats = beatsOf<DotBeat>(
    remedial && 'compare',
    'setup',
    remedial && 'try',
    'equation',
    'solve',
    'sign',
    remedial && 'end',
  );
  return scene({
    template: 'dot_pairs',
    params: {
      mode: 'perp',
      u,
      v,
      uFilled: put(u),
      vFilled: put(v),
      products,
      equationLine,
      solveLine,
      answer,
      sign: 'right',
      ...(wrongLine && { wrongLine }),
      ...(student && { student: rationalText(student) }),
      ...(remedial && { try: choiceOf('u · v = 0', ['u = kv'], answer.n + 3) }),
    },
    beats,
    captions: {
      compare: fillTokens(copy.compare_perp, { mine: student ? rationalText(student) : '' }),
      setup: copy.perp_setup,
      try: copy.try_perp,
      equation: fillTokens(copy.equation, { line: equationLine }),
      solve: fillTokens(copy.solve, { line: solveLine }),
      sign: copy.perp_sign,
      end: copy.end_perp,
    },
    voice: {
      compare: 'v_dot.compare_perp',
      setup: 'v_dot.perp_setup',
      try: 'v_dot.try_perp',
      equation: 'v_dot.equation',
      solve: 'v_dot.solve',
      sign: 'v_dot.sign_right',
      end: 'v_dot.end_perp',
    },
    ms: { equation: 4000, solve: 3500 },
    hint: { caption: copy.hint_perp, voice: 'v_dot.perp_setup' },
    studentAnswer,
    purpose,
  });
}
