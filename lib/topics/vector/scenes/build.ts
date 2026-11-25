import { thVector } from '@/lib/content/th.vector';
import type { Rational } from '@/lib/core/rational';
import { surdText, type Surd } from '@/lib/core/surd';
import type { Answer } from '@/lib/core/types';
import type { ClipHint } from '@/lib/topics/matrix/scenes/types';
import { choiceOf } from '@/lib/topics/matrix/scenes/tryChoice';
import { rationalText, surdVecText, vecText } from '../format';
import type { Slot } from '../types';
import type {
  ScenePurpose,
  VectorBeatsByTemplate,
  VectorParamsByTemplate,
  VectorSceneOf,
  VectorTemplate,
} from './types';
import { voicedBeats, type VoiceId } from './voice';

// What every vector spec builder shares: the written forms of numbers, and putting a spec together so
// that its captions, lines and lengths cover exactly the beats it plays.

export { choiceOf, rationalText, surdText, surdVecText, vecText };

/** A factor inside a product, bracketed when negative: (−2). */
export function factor(value: Rational): string {
  return value.sign() < 0 ? `(${rationalText(value)})` : rationalText(value);
}

export function surdFactor(value: Surd): string {
  return value.sign() < 0 ? `(${surdText(value)})` : surdText(value);
}

export function slotText(slot: Slot): string {
  return typeof slot === 'string' ? slot : rationalText(slot);
}

export function slotFactor(slot: Slot): string {
  return typeof slot === 'string' ? slot : factor(slot);
}

/** 6 + (−2) + 3: the first term bare, every later negative one bracketed. */
export function sumText(values: readonly Rational[]): string {
  return values.map((value, i) => (i === 0 ? rationalText(value) : factor(value))).join(' + ');
}

/** 1² + (−4)² + 1². */
export function squaresText(values: readonly Rational[]): string {
  return values.map((value) => `${factor(value)}²`).join(' + ');
}

/** What a student typed, as the screen writes it. */
export function answerText(answer: Answer): string {
  switch (answer.kind) {
    case 'scalar':
      return rationalText(answer.value);
    case 'surd':
      return surdText(answer.value);
    case 'vector':
      return surdVecText(answer.value);
    case 'choice':
      return (thVector.choices as Record<string, string>)[answer.id] ?? answer.id;
    default:
      return '';
  }
}

export const studentVector = (answer: Answer | undefined): Surd[] | undefined =>
  answer?.kind === 'vector' ? answer.value : undefined;

/** The default length of a beat with nothing to say yet. Its line usually makes it longer. */
export const BEAT_MS = 2500;

export interface SceneParts<T extends VectorTemplate> {
  template: T;
  params: VectorParamsByTemplate[T];
  beats: VectorBeatsByTemplate[T][];
  captions: Partial<Record<VectorBeatsByTemplate[T], string>>;
  voice: Partial<Record<VectorBeatsByTemplate[T], VoiceId>>;
  /** At least this long, for beats with a lot to watch. */
  ms?: Partial<Record<VectorBeatsByTemplate[T], number>>;
  /** What a wrong tap on the `try` beat gets. */
  hint?: ClipHint;
  studentAnswer?: Answer;
  purpose: ScenePurpose;
}

/** Keeps only the beats that play, so a spec carries no caption or line it never uses. */
function only<Beat extends string, V>(
  beats: readonly Beat[],
  values: Partial<Record<Beat, V>>,
): Partial<Record<Beat, V>> {
  const kept: Partial<Record<Beat, V>> = {};
  for (const beat of beats) if (values[beat] !== undefined) kept[beat] = values[beat];
  return kept;
}

export function scene<T extends VectorTemplate>({
  template,
  params,
  beats,
  captions,
  voice,
  ms = {},
  hint,
  studentAnswer,
  purpose,
}: SceneParts<T>): VectorSceneOf<T> {
  type Beat = VectorBeatsByTemplate[T];
  const lines = only(beats, voice);
  const base = Object.fromEntries(
    beats.map((beat) => [beat, (ms as Partial<Record<Beat, number>>)[beat] ?? BEAT_MS]),
  ) as Partial<Record<Beat, number>>;
  const asks = (beats as string[]).includes('try');
  const opens = (beats as string[]).includes('compare');
  return {
    template,
    params,
    beats,
    captions: only(beats, captions),
    beatMs: voicedBeats(base, lines),
    voice: lines,
    ...(asks && hint && { waits: ['try' as Beat], hints: { ['try' as Beat]: hint } }),
    ...(studentAnswer && { compare: { studentAnswer } }),
    ...(opens && { flagged: 'compare' as Beat }),
    purpose,
  } as VectorSceneOf<T>;
}

/** The beats that are not undefined or false, in order. */
export function beatsOf<Beat extends string>(...beats: (Beat | false | undefined)[]): Beat[] {
  return beats.filter((beat): beat is Beat => typeof beat === 'string');
}
