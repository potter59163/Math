import { thVector } from '@/lib/content/th.vector';
import { Rational } from '@/lib/core/rational';
import { Surd, surdText } from '@/lib/core/surd';
import { fillTokens } from '@/lib/core/tokens';
import type { Answer } from '@/lib/core/types';
import { norm, normSq, sum, unit } from '../ops';
import type { DataOf, MisconceptionId } from '../types';
import {
  beatsOf,
  choiceOf,
  rationalText,
  scene,
  squaresText,
  studentVector,
  sumText,
  surdVecText,
} from './build';
import type { ScenePurpose, UnitBeat, VectorSceneOf } from './types';

type UnitData = DataOf<'unit' | 'scaled_unit' | 'direction_cosines'>;

export interface UnitInput {
  data: UnitData;
  purpose: ScenePurpose;
  studentAnswer?: Answer;
  caught?: MisconceptionId;
}

/** (1/3)² + (2/3)² + (2/3)², the squared length of a vector of surds, with its exact value. */
function squaredLength(parts: readonly Surd[]): { text: string; value: Rational } {
  const text = parts.map((part) => `(${surdText(part)})²`).join(' + ');
  const value = parts.reduce((total, part) => total.add(part.square()), Rational.ZERO);
  return { text, value };
}

/** VECTORS §5 `unit_shrink`: the arrow keeps its direction and shrinks to length 1. */
export function unitScene({
  data,
  purpose,
  studentAnswer,
  caught,
}: UnitInput): VectorSceneOf<'unit_shrink'> {
  const copy = thVector.scenes.unit;
  const { v } = data;
  const length = norm(v);
  const parts = unit(v);
  const scaledLength = data.form === 'scaled_unit' ? data.length : null;
  const student = studentVector(studentAnswer);
  const remedial = student !== undefined;
  const squared = caught !== 'V13_UNIT_DIVIDE_SUM';
  const final = scaledLength === null ? parts : parts.map((part) => part.mul(scaledLength));
  const check = squaredLength(final);
  // How long the student's vector is, which is never the length asked for on these mistakes.
  const theirs = student && squaredLength(student);

  const beats = beatsOf<UnitBeat>(
    remedial && 'compare',
    !remedial && scaledLength === null && 'arrow',
    'norm',
    'divide',
    scaledLength !== null && 'scale',
    'check',
    remedial && 'try',
    remedial && 'end',
  );
  const divisorRight = `|v| = ${surdText(length)}`;
  const divisorWrong = squared
    ? `|v|² = ${rationalText(normSq(v))}`
    : `${sumText(v)} = ${rationalText(sum(v))}`;
  return scene({
    template: 'unit_shrink',
    params: {
      v,
      norm: length,
      normLine: `|v| = √(${squaresText(v)}) = ${surdText(length)}`,
      unit: parts,
      ...(scaledLength !== null && {
        scaled: { length: scaledLength, value: parts.map((part) => part.mul(scaledLength)) },
      }),
      directionCosines: data.form === 'direction_cosines',
      divideLines: v.map(
        (part, i) => `${rationalText(part)} ÷ ${surdText(length)} = ${surdText(parts[i])}`,
      ),
      checkLine: `${check.text} = ${rationalText(check.value)}`,
      ...(student && { student }),
      ...(theirs && {
        studentCheck: surdText(Surd.sqrt(theirs.value)),
        wrongDivisor: divisorWrong,
      }),
      ...(remedial && { try: choiceOf(divisorRight, [divisorWrong], v[0].n + v.length) }),
    },
    beats,
    captions: {
      compare: fillTokens(squared ? copy.compare_squared : copy.compare_sum, {
        mine: student ? surdVecText(student) : '',
        divisor: divisorWrong,
      }),
      arrow: copy.arrow,
      norm: fillTokens(copy.norm, { right: surdText(length) }),
      divide: data.form === 'direction_cosines' ? copy.dircos : copy.divide,
      check: theirs
        ? fillTokens(copy.check_wrong, {
            right: String(scaledLength ?? 1),
            theirs: surdText(Surd.sqrt(theirs.value)),
          })
        : fillTokens(copy.check, { right: String(scaledLength ?? 1) }),
      scale: fillTokens(copy.scale, { length: String(scaledLength ?? '') }),
      try: copy.try,
      end: copy.end,
    },
    voice: {
      compare: squared ? 'v_unit.compare_squared' : 'v_unit.compare_sum',
      arrow: 'v_unit.arrow',
      norm: 'v_unit.norm',
      divide: data.form === 'direction_cosines' ? 'v_unit.dircos' : 'v_unit.divide',
      check: theirs ? 'v_unit.check_wrong' : 'v_unit.check',
      scale: 'v_unit.scale',
      try: 'v_unit.try',
      end: 'v_unit.end',
    },
    ms: { divide: 4000, check: 3500 },
    hint: { caption: copy.hint, voice: 'v_unit.hint' },
    studentAnswer,
    purpose,
  });
}
