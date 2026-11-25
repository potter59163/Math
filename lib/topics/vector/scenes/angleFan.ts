import { thVector } from '@/lib/content/th.vector';
import { Surd, surdText } from '@/lib/core/surd';
import { fillTokens } from '@/lib/core/tokens';
import type { Answer } from '@/lib/core/types';
import { angleOfCos, cosAngle, cosOf, dot, norm, normSq } from '../ops';
import { STANDARD_ANGLES, type Angle, type DataOf, type MisconceptionId } from '../types';
import { answerText, beatsOf, choiceOf, rationalText, scene, surdFactor } from './build';
import { productsText } from './dotPairs';
import type { AngleBeat, AngleFanParams, ScenePurpose, VectorSceneOf } from './types';

export interface AngleInput {
  data: DataOf<'cos_angle' | 'angle'>;
  purpose: ScenePurpose;
  studentAnswer?: Answer;
  caught?: MisconceptionId;
}

/** VECTORS §5 `angle_fan`: cos θ is a place on the diameter of a half circle, and θ is read above it. */
export function angleScene({
  data,
  purpose,
  studentAnswer,
  caught,
}: AngleInput): VectorSceneOf<'angle_fan'> {
  const copy = thVector.scenes.angle;
  const { u, v } = data;
  const value = dot(u, v);
  const normU = norm(u);
  const normV = norm(v);
  const cos = cosAngle(u, v);
  const theta = angleOfCos(cos);
  const remedial = studentAnswer !== undefined;
  const mode: AngleFanParams['mode'] = caught === 'V18_ANGLE_SQUARED_NORMS' ? 'cosine' : 'angle';
  const mirror = theta !== null && theta !== 90 ? ((180 - theta) as Angle) : undefined;
  const cosLine = `cos θ = ${rationalText(value)}/(${surdText(normU)} · ${surdFactor(normV)}) = ${surdText(cos)}`;
  const wrongLine =
    mode === 'cosine'
      ? `${rationalText(value)}/(${rationalText(normSq(u))} · ${rationalText(normSq(v))}) = ${surdText(Surd.rational(value.div(normSq(u).mul(normSq(v)))))}`
      : undefined;

  const beats = beatsOf<AngleBeat>(
    remedial && 'compare',
    'dot',
    'norms',
    remedial && mode === 'cosine' && 'try',
    'cos',
    remedial && mode === 'angle' && 'try',
    'fan',
    'end',
  );
  const obtuse = value.sign() < 0;
  // An angle is answered in degrees, and shown so.
  const student =
    studentAnswer &&
    `${answerText(studentAnswer)}${studentAnswer.kind === 'scalar' && mode === 'angle' ? '°' : ''}`;
  return scene({
    template: 'angle_fan',
    params: {
      mode,
      u,
      v,
      dotLine: `u · v = ${productsText(u, v)} = ${rationalText(value)}`,
      normsLine: `|u| = ${surdText(normU)},  |v| = ${surdText(normV)}`,
      cosLine,
      cos,
      theta,
      ticks: STANDARD_ANGLES.map((angle) => ({ theta: angle, cos: cosOf(angle) })),
      ...(mirror !== undefined && { mirror }),
      ...(wrongLine && { wrongLine }),
      ...(student && { student }),
      ...(remedial &&
        mode === 'angle' &&
        theta !== null &&
        mirror !== undefined && { try: choiceOf(`${theta}°`, [`${mirror}°`], theta / 15) }),
      ...(remedial && mode === 'cosine' && { try: choiceOf('|u||v|', ['|u|²|v|²'], value.n) }),
    },
    beats,
    captions: {
      compare: fillTokens(mode === 'cosine' ? copy.compare_squared : copy.compare_abs, {
        mine: student ?? '',
      }),
      dot: fillTokens(copy.dot, { value: rationalText(value) }),
      norms: copy.norms,
      try: mode === 'cosine' ? copy.try_cos : copy.try_angle,
      cos: copy.cos,
      fan:
        theta === null
          ? copy.fan_between
          : fillTokens(obtuse ? copy.fan_obtuse : copy.fan, { theta: String(theta) }),
      end: copy.end,
    },
    voice: {
      compare: mode === 'cosine' ? 'v_angle.compare_squared' : 'v_angle.compare_abs',
      dot: 'v_angle.dot',
      norms: 'v_angle.norms',
      try: mode === 'cosine' ? 'v_angle.try_cos' : 'v_angle.try_angle',
      cos: 'v_angle.cos',
      fan: obtuse ? 'v_angle.fan_obtuse' : 'v_angle.fan',
      end: 'v_angle.end',
    },
    ms: { cos: 3500, fan: 4000 },
    hint:
      mode === 'cosine'
        ? { caption: copy.hint_cos, voice: 'v_angle.hint_cos' }
        : { caption: copy.hint_angle, voice: 'v_angle.hint_angle' },
    studentAnswer,
    purpose,
  });
}
