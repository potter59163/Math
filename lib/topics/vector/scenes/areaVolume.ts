import { thVector } from '@/lib/content/th.vector';
import { Rational } from '@/lib/core/rational';
import { Surd, surdText } from '@/lib/core/surd';
import { fillTokens } from '@/lib/core/tokens';
import type { Answer } from '@/lib/core/types';
import { cross, dot, norm, sub, triple } from '../ops';
import type { DataOf, MisconceptionId, Vec } from '../types';
import { answerText, beatsOf, choiceOf, rationalText, scene, surdFactor, vecText } from './build';
import { dotLine } from './crossCover';
import type { AreaBeat, AreaMistake, AreaVolumeParams, ScenePurpose, VectorSceneOf } from './types';
import type { VoiceId } from './voice';

type AreaData = DataOf<'area_parallelogram' | 'area_triangle' | 'volume'>;

export interface AreaInput {
  data: AreaData;
  purpose: ScenePurpose;
  studentAnswer?: Answer;
  caught?: MisconceptionId;
}

const MISTAKES: Partial<Record<MisconceptionId, AreaMistake>> = {
  V23_TRIANGLE_NO_HALF: 'no_half',
  V24_AREA_DOT: 'dot',
  V25_VOLUME_SIGNED: 'signed',
  V26_VOLUME_MAG_PRODUCT: 'product',
};

const COMPARE_VOICE: Record<AreaMistake, VoiceId> = {
  dot: 'v_area.compare_dot',
  no_half: 'v_area.compare_half',
  signed: 'v_area.compare_signed',
  product: 'v_area.compare_product',
};

/** |c| written out: √(16 + 4 + 25) = 3√5. */
function normLine(name: string, c: Vec): string {
  const squares = c.map((part) => rationalText(part.mul(part))).join(' + ');
  return `|${name}| = √(${squares}) = ${surdText(norm(c))}`;
}

/** VECTORS §5 `area_volume`: the parallelogram of u and v, its half, and the slanted box of u, v, w. */
export function areaScene(input: AreaInput): VectorSceneOf<'area_volume'> {
  return input.data.form === 'volume'
    ? boxScene({ ...input, data: input.data })
    : flatScene({ ...input, data: input.data });
}

function flatScene({
  data,
  purpose,
  studentAnswer,
  caught,
}: AreaInput & {
  data: DataOf<'area_parallelogram' | 'area_triangle'>;
}): VectorSceneOf<'area_volume'> {
  const copy = thVector.scenes.area;
  const triangle = data.form === 'area_triangle';
  const [u, v] = triangle ? [sub(data.B, data.A), sub(data.C, data.A)] : [data.u, data.v];
  const names = triangle ? ['AB', 'AC'] : ['u', 'v'];
  const product = `${names[0]} × ${names[1]}`;
  const c = cross(u, v);
  const area = norm(c);
  const half = area.div(2);
  const right = triangle ? half : area;
  const mistake = caught ? MISTAKES[caught] : undefined;
  const remedial = studentAnswer !== undefined && mistake !== undefined;
  const dotValue = dot(u, v).abs();
  const wrongLine =
    mistake === 'dot'
      ? triangle
        ? `½ |${names[0]} · ${names[1]}| = ${rationalText(dotValue.div(Rational.of(2)))}`
        : `|${names[0]} · ${names[1]}| = ${rationalText(dotValue)}`
      : undefined;

  const beats = beatsOf<AreaBeat>(
    remedial && 'compare',
    'shape',
    remedial && mistake === 'dot' && 'try',
    'cross',
    'norm',
    remedial && mistake === 'no_half' && 'try',
    triangle && 'half',
    remedial && 'end',
  );
  const student = studentAnswer && answerText(studentAnswer);
  const question =
    mistake === 'dot'
      ? choiceOf(`|${product}|`, [`|${names[0]} · ${names[1]}|`], u[0].n)
      : choiceOf(surdText(half), [surdText(area)], v[0].n);
  return scene({
    template: 'area_volume',
    params: {
      mode: triangle ? 'triangle' : 'parallelogram',
      edges: [u, v],
      names,
      ...(triangle && {
        corner: data.A,
        sidesLine: `AB = ${vecText(u)},  AC = ${vecText(v)}`,
      }),
      cross: c,
      crossLine: `${product} = ${vecText(c)}`,
      normLine: normLine(product, c),
      area,
      ...(triangle && { halfLine: `½ · ${surdFactor(area)} = ${surdText(half)}` }),
      ...(mistake && remedial && { mistake }),
      ...(wrongLine && { wrongLine }),
      ...(student && { student }),
      right: surdText(right),
      ...(remedial && { try: question }),
    },
    beats,
    captions: {
      compare: fillTokens(mistake === 'no_half' ? copy.compare_half : copy.compare_dot, {
        mine: student ?? '',
      }),
      shape: triangle ? copy.sides : copy.shape,
      try: mistake === 'dot' ? copy.try_area : copy.try_half,
      cross: fillTokens(copy.cross, { product }),
      norm: fillTokens(copy.norm, { right: surdText(area) }),
      half: fillTokens(copy.half, { right: surdText(half) }),
      end: copy.end_area,
    },
    voice: {
      compare: mistake ? COMPARE_VOICE[mistake] : 'v_area.compare_dot',
      shape: triangle ? 'v_area.sides' : 'v_area.shape',
      try: mistake === 'dot' ? 'v_area.try_area' : 'v_area.try_half',
      cross: 'v_area.cross',
      norm: 'v_area.norm',
      half: 'v_area.half',
      end: 'v_area.end_area',
    },
    ms: { shape: 3500, norm: 3500 },
    hint:
      mistake === 'dot'
        ? { caption: copy.hint_area, voice: 'v_area.end_area' }
        : { caption: copy.hint_half, voice: 'v_area.half' },
    studentAnswer: remedial ? studentAnswer : undefined,
    purpose,
  });
}

function boxScene({
  data,
  purpose,
  studentAnswer,
  caught,
}: AreaInput & { data: DataOf<'volume'> }): VectorSceneOf<'area_volume'> {
  const copy = thVector.scenes.area;
  const { u, v, w } = data;
  const c = cross(v, w);
  const value = triple(u, v, w);
  const volume = value.abs();
  const mistake = caught ? MISTAKES[caught] : undefined;
  const remedial = studentAnswer !== undefined && mistake !== undefined;
  const sizes = [norm(u), norm(v), norm(w)];
  const product = sizes.reduce((total, size) => total.mul(size), Surd.ONE);
  const beats = beatsOf<AreaBeat>(
    remedial && 'compare',
    !remedial && 'shape',
    remedial && mistake === 'product' && 'tilt',
    remedial && mistake === 'signed' && 'shape',
    'base',
    'dot',
    remedial && 'try',
    'abs',
  );
  const student = studentAnswer && answerText(studentAnswer);
  const params: AreaVolumeParams = {
    mode: 'box',
    edges: [u, v, w],
    names: ['u', 'v', 'w'],
    cross: c,
    crossLine: `v × w = ${vecText(c)}`,
    dotLine: `u · (v × w) = ${dotLine(c, u)}`,
    triple: value,
    volume,
    productLine: `|u||v||w| = ${sizes.map(surdFactor).join(' · ')} = ${surdText(product)}`,
    ...(mistake && remedial && { mistake }),
    ...(student && { student }),
    right: rationalText(volume),
    ...(remedial && {
      try: choiceOf(
        rationalText(volume),
        [mistake === 'product' ? surdText(product) : rationalText(value)],
        u[0].n + w[2].n,
      ),
    }),
  };
  return scene({
    template: 'area_volume',
    params,
    beats,
    captions: {
      compare: fillTokens(mistake === 'product' ? copy.compare_product : copy.compare_signed, {
        mine: student ?? '',
      }),
      shape: copy.box,
      tilt: copy.tilt,
      base: fillTokens(copy.base, { line: params.crossLine }),
      dot: fillTokens(copy.dot, { value: rationalText(value) }),
      try: copy.try_volume,
      abs: fillTokens(copy.abs, { right: rationalText(volume) }),
    },
    voice: {
      compare: mistake ? COMPARE_VOICE[mistake] : 'v_area.compare_signed',
      shape: 'v_area.box',
      tilt: 'v_area.tilt',
      base: 'v_area.base',
      dot: 'v_area.dot',
      try: 'v_area.try_volume',
      abs: 'v_area.abs',
    },
    ms: { shape: 3500, dot: 3500 },
    hint:
      mistake === 'product'
        ? { caption: copy.hint_product, voice: 'v_area.hint_product' }
        : { caption: copy.hint_signed, voice: 'v_area.abs' },
    studentAnswer: remedial ? studentAnswer : undefined,
    purpose,
  });
}
