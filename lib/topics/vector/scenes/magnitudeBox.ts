import { thVector } from '@/lib/content/th.vector';
import { Rational } from '@/lib/core/rational';
import { Surd, surdText } from '@/lib/core/surd';
import { fillTokens } from '@/lib/core/tokens';
import type { Answer } from '@/lib/core/types';
import { linearExprText } from '../format';
import { norm, normSq, scale, sub, sum } from '../ops';
import { linearVec } from '../solve';
import type { DataOf, MisconceptionId, Vec } from '../types';
import { answerText, beatsOf, choiceOf, rationalText, scene, squaresText, vecText } from './build';
import type { MagnitudeBeat, MagnitudeBoxParams, ScenePurpose, VectorSceneOf } from './types';

type MagnitudeData = DataOf<'magnitude' | 'magnitude_combo' | 'distance'>;

export interface MagnitudeInput {
  data: MagnitudeData;
  purpose: ScenePurpose;
  studentAnswer?: Answer;
  caught?: MisconceptionId;
}

function measured(data: MagnitudeData): Vec {
  switch (data.form) {
    case 'magnitude':
      return data.v;
    case 'magnitude_combo':
      return linearVec(data.terms);
    case 'distance':
      return sub(data.B, data.A);
  }
}

/** √18 = 3√2, or just √41 when there is nothing to take out. */
export function rootLine(square: Rational): string {
  const root = Surd.sqrt(square);
  const raw = `√${rationalText(square)}`;
  return surdText(root) === raw ? raw : `${raw} = ${surdText(root)}`;
}

/** VECTORS §5 `magnitude_box`: Pythagoras on the floor of the box, then up its side, then √. */
export function magnitudeScene({
  data,
  purpose,
  studentAnswer,
  caught,
}: MagnitudeInput): VectorSceneOf<'magnitude_box'> {
  const copy = thVector.scenes.mag;
  const v = measured(data);
  const flat = v.length === 2;
  const square = normSq(v);
  const length = norm(v);
  const remedial = studentAnswer !== undefined;
  const mode: MagnitudeBoxParams['mode'] =
    caught === 'V10_MAG_SUM_COMPONENTS'
      ? 'walk'
      : caught === 'V11_MAG_ADDITIVE' || (!remedial && data.form === 'magnitude_combo')
        ? 'triangle'
        : 'box';

  const from: MagnitudeBoxParams['from'] =
    data.form === 'distance'
      ? {
          kind: 'points',
          A: data.A,
          B: data.B,
          line: `AB = B − A = ${vecText(v)}`,
        }
      : data.form === 'magnitude_combo'
        ? {
            kind: 'combo',
            terms: data.terms.map(({ k, name, vec }) => {
              const value = scale(Rational.of(k), vec);
              return { label: linearExprText([{ k, name }]), vec: value, norm: norm(value) };
            }),
            line: `${linearExprText(data.terms)} = ${vecText(v)}`,
          }
        : undefined;
  const parts = from?.kind === 'combo' ? from.terms : [];
  const partsSum = parts.reduce<Surd | null>(
    (total, t) => total?.addSame(t.norm) ?? null,
    Surd.ZERO,
  );

  const floorSquare = v[0].mul(v[0]).add(v[1].mul(v[1]));
  const intro = purpose === 'intro';
  const triangle = mode === 'triangle';
  // Two steps of Pythagoras in one beat, except in the intro, which has the time to show each.
  const twice = !flat && !intro;

  const beats = beatsOf<MagnitudeBeat>(
    remedial && 'compare',
    !triangle && from?.kind === 'points' && 'points',
    triangle && 'chain',
    !triangle && !remedial && from?.kind !== 'points' && 'box',
    (mode === 'walk' || intro) && 'walk',
    triangle ? 'combine' : 'floor',
    !triangle && !flat && !twice && 'rise',
    !remedial && 'square',
    'root',
    remedial && 'try',
    (remedial || intro) && 'end',
  );

  const student = studentAnswer ? answerText(studentAnswer) : undefined;
  return scene({
    template: 'magnitude_box',
    params: {
      mode,
      v,
      ...(from && { from }),
      edges: v.map((part) => part.abs()),
      ...(!flat && {
        floor: { line: `√(${squaresText(v.slice(0, 2))}) = ${rootLine(floorSquare)}` },
      }),
      squaresLine: `${squaresText(v)} = ${rationalText(square)}`,
      rootLine: rootLine(square),
      norm: length,
      ...((mode === 'walk' || intro) && {
        walkLine: `${v.map((part) => `|${rationalText(part)}|`).join(' + ')} = ${rationalText(sum(v.map((part) => part.abs())))}`,
      }),
      ...(triangle &&
        partsSum && {
          sumLine: `${parts.map((t) => `|${t.label}|`).join(' + ')} = ${parts.map((t) => surdText(t.norm)).join(' + ')} = ${surdText(partsSum)}`,
        }),
      ...(student && { student }),
      ...(student && {
        try: choiceOf(surdText(length), [student], square.n),
      }),
    },
    beats,
    captions: {
      compare: fillTokens(
        mode === 'walk' ? copy.compare_walk : triangle ? copy.compare_add : copy.compare_root,
        { mine: student ?? '', right: surdText(length) },
      ),
      points: fillTokens(copy.points, { line: from?.line ?? '' }),
      chain: copy.chain,
      box: intro ? copy.intro_box : copy.box,
      walk: copy.walk,
      combine: fillTokens(copy.combine, { line: from?.line ?? '' }),
      floor: flat ? copy.flat : twice ? copy.twice : copy.floor,
      rise: copy.rise,
      square: copy.square,
      root: fillTokens(remedial ? copy.square_root : copy.root, { right: surdText(length) }),
      try: copy.try,
      end: copy.end,
    },
    voice: {
      compare:
        mode === 'walk'
          ? 'v_mag.compare_walk'
          : triangle
            ? 'v_mag.compare_add'
            : 'v_mag.compare_root',
      points: 'v_mag.points',
      chain: 'v_mag.chain',
      box: 'v_mag.box',
      walk: 'v_mag.walk',
      combine: 'v_mag.combine',
      floor: flat ? 'v_mag.flat' : twice ? 'v_mag.twice' : 'v_mag.floor',
      rise: 'v_mag.rise',
      square: 'v_mag.square',
      root: remedial ? 'v_mag.square_root' : 'v_mag.root',
      try: 'v_mag.try',
      end: 'v_mag.end',
    },
    ms: { floor: 3500, rise: 3500, root: 3500 },
    hint:
      mode === 'walk'
        ? { caption: copy.hint_walk, voice: 'v_mag.walk' }
        : triangle
          ? { caption: copy.hint_add, voice: 'v_mag.hint_add' }
          : { caption: copy.hint_root, voice: 'v_mag.square_root' },
    studentAnswer,
    purpose,
  });
}
