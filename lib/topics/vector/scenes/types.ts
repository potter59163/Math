import type { Rational } from '@/lib/core/rational';
import type { Surd } from '@/lib/core/surd';
import type { Answer } from '@/lib/core/types';
import type { ClipHint, ScenePurpose, TryChoice } from '@/lib/topics/matrix/scenes/types';
import type { VoiceId } from '@/lib/topics/matrix/scenes/voice';
import type { Angle, Slot, Vec, VecName } from '../types';

// SceneSpec of the vector clips (docs/VECTORS.md §5), in the shape of docs/SCENES.md §2. Every number a
// template writes on screen is worked out here by the engine and handed over as text or as an exact
// Rational or Surd. The only floats are where things are drawn (VECTORS §1), and the template works
// those out itself from the exact coordinates.

export type { ScenePurpose, TryChoice };

/** A point of a geometry figure, in its hidden coordinates. Halves appear at midpoints. */
export type FigureXY = [x: number, y: number];

// ---- quantity_sort

export type QuantityBeat =
  'compare' | 'cards' | 'ask' | 'sort' | 'pair' | 'arrow' | 'equal' | 'opposite' | 'try' | 'end';

export interface QuantityCard {
  label: string;
  kind: 'vector' | 'scalar';
}

export interface QuantitySortParams {
  cards: QuantityCard[];
  ask: 'vector' | 'scalar';
  /** The card that answers the item, and the one the student picked. */
  answer: number;
  student?: number;
  /** A vector quantity and the scalar it is mixed up with, as card indexes. */
  pair?: [vector: number, scalar: number];
  try?: TryChoice;
}

// ---- arrow_chain

export type ArrowChainBeat =
  | 'compare'
  | 'figure'
  | 'asked'
  | 'slide'
  | 'flip'
  | 'terms'
  | 'negate'
  | 'chain'
  | 'result'
  | 'try'
  | 'end';

export type ArrowChainMode = 'equal' | 'sub' | 'parallelogram' | 'chain';

export type ArrowTone = 'row' | 'col' | 'third' | 'good' | 'warn';

/** Where an arrow is from a beat on. */
export interface ArrowSpot {
  beat: ArrowChainBeat;
  from: FigureXY;
  to: FigureXY;
}

export interface ChainArrow {
  /** A named vector such as "AB", "−AD" or "2MN". */
  label: string;
  tone: ArrowTone;
  /** The beats it is seen on. */
  on: ArrowChainBeat[];
  /** Where it is from each beat on, moving between them by translation. Before the first, at the first. */
  spots: ArrowSpot[];
}

export interface ArrowChainParams {
  mode: ArrowChainMode;
  shape: 'parallelogram' | 'triangle';
  points: { label: string; at: FigureXY }[];
  /** The polygon, in drawing order. */
  outline: string[];
  arrows: ChainArrow[];
  /** What the item asks, such as "AB + AD", and the option that answers it. */
  asked: string;
  answer: string;
  student?: string;
  try?: TryChoice;
}

// ---- component_steps

export type ComponentBeat =
  | 'compare'
  | 'axes'
  | 'setup'
  | 'read'
  | `comp_${number}`
  | `scale_${number}`
  | 'sum'
  | 'try'
  | 'done';

export type ComponentMode = 'points' | 'scale' | 'combo';

export interface ScaledTerm {
  /** As written before the term, so −2 for "− 2v". */
  k: number;
  name: VecName;
  vec: Vec;
  scaled: Vec;
  /** Per component, such as "−2 · 4 = −8". */
  lines: string[];
}

export interface ComponentStepsParams {
  mode: ComponentMode;
  size: 2 | 3;
  /** Points mode: B − A. */
  A?: Vec;
  B?: Vec;
  terms?: ScaledTerm[];
  /** How the item wrote it, such as "3u − 2v" or "2i − j + 3k". */
  expression: string;
  /** ai + bj + ck read as (a, b, c), on items that write them so. */
  ijk?: string[];
  result: Vec;
  /** Per component, such as "4 − 1 = 3". */
  lines: string[];
  student?: Surd[];
  try?: TryChoice;
}

// ---- parallel_scale

export type ParallelBeat =
  'compare' | 'setup' | 'stretch' | 'find_k' | 'solve' | 'check' | 'try' | 'end';

export interface ParallelScaleParams {
  u: Slot[];
  v: Slot[];
  ask: string;
  /** u = kv. */
  k: Rational;
  /** The component where both are given, which fixes k, and where the unknown is. */
  pair: number;
  unknown: { vector: 'u' | 'v'; index: number };
  kLine: string;
  solveLine: string;
  answer: Rational;
  /** u and v with the unknown put in, for the check. */
  uFilled: Vec;
  vFilled: Vec;
  student?: Rational;
  wrongLine?: string;
  try?: TryChoice;
}

// ---- magnitude_box

export type MagnitudeBeat =
  | 'compare'
  | 'points'
  | 'chain'
  | 'combine'
  | 'box'
  | 'walk'
  | 'floor'
  | 'rise'
  | 'square'
  | 'root'
  | 'try'
  | 'end';

export type MagnitudeMode = 'box' | 'walk' | 'triangle';

export interface MagnitudeBoxParams {
  mode: MagnitudeMode;
  /** The vector whose length is asked: v, pu + qv, or B − A. */
  v: Vec;
  /** How the item gave it. */
  from?:
    | { kind: 'points'; A: Vec; B: Vec; line: string }
    | { kind: 'combo'; terms: { label: string; vec: Vec; norm: Surd }[]; line: string };
  /** |a|, |b|, |c|, written on the edges of the box. */
  edges: Rational[];
  /** √(a² + b²) on a 3D box, the diagonal of its floor. */
  floor?: { line: string };
  squaresLine: string;
  /** "√18 = 3√2", or "√25 = 5". */
  rootLine: string;
  norm: Surd;
  /** What walking along the axes adds up to, for V10. */
  walkLine?: string;
  /** |u| + |v| against |u + v|, for V11. */
  sumLine?: string;
  student?: string;
  try?: TryChoice;
}

// ---- unit_shrink

export type UnitBeat = 'compare' | 'arrow' | 'norm' | 'divide' | 'scale' | 'check' | 'try' | 'end';

export interface UnitShrinkParams {
  v: Vec;
  norm: Surd;
  normLine: string;
  unit: Surd[];
  /** "The vector of length 7 in the direction of v". */
  scaled?: { length: number; value: Surd[] };
  directionCosines: boolean;
  /** Per component, such as "2/3". */
  divideLines: string[];
  checkLine: string;
  student?: Surd[];
  /** How long the student's vector is, which is never 1 on these mistakes. */
  studentCheck?: string;
  /** What the student divided by, such as "|v|² = 9". */
  wrongDivisor?: string;
  try?: TryChoice;
}

// ---- dot_pairs

export type DotBeat =
  | 'compare'
  | 'picture'
  | 'setup'
  | 'pair'
  | 'multiply'
  | 'sum'
  | 'sign'
  | 'formula'
  | 'cos'
  | 'equation'
  | 'solve'
  | 'try'
  | 'end';

export type DotMode = 'pairs' | 'angle' | 'perp';

export interface DotPairsParams {
  mode: DotMode;
  /** Components, k standing for the unknown on perp items. */
  u?: Slot[];
  v?: Slot[];
  /** Per component, such as "3 · 4 = 12" or "k · 1 = k". */
  products?: string[];
  sumLine?: string;
  value?: Surd;
  sign?: 'acute' | 'right' | 'obtuse';
  /** For the picture: u and v with any unknown put in. */
  uFilled?: Vec;
  vFilled?: Vec;
  /** Angle mode: |u|, |v| and θ. */
  normU?: Surd;
  normV?: Surd;
  theta?: Angle;
  cos?: Surd;
  cosLine?: string;
  /** Perp mode. */
  equationLine?: string;
  solveLine?: string;
  answer?: Rational;
  /** What the mistake works out, struck through. */
  wrongLine?: string;
  student?: string;
  try?: TryChoice;
}

// ---- angle_fan

export type AngleBeat = 'compare' | 'dot' | 'norms' | 'cos' | 'fan' | 'try' | 'end';

export type AngleMode = 'angle' | 'cosine';

export interface AngleFanParams {
  mode: AngleMode;
  u: Vec;
  v: Vec;
  dotLine: string;
  normsLine: string;
  cosLine: string;
  cos: Surd;
  /** Null when cos θ is not one of a standard angle, as on some cos θ items. */
  theta: Angle | null;
  /** The standard angles the fan marks, with their cosines. */
  ticks: { theta: Angle; cos: Surd }[];
  /** 180° − θ, the angle V17 reads off. */
  mirror?: Angle;
  wrongLine?: string;
  student?: string;
  try?: TryChoice;
}

// ---- cross_cover

export type CrossBeat =
  | 'compare'
  | 'setup'
  | 'cover_i'
  | 'cover_j'
  | 'cover_k'
  | 'result'
  | 'check'
  | 'flip'
  | 'try'
  | 'end';

export type CrossMistake = 'middle_sign' | 'order' | 'componentwise';

export interface CrossCoverParams {
  /** In the order the item multiplies them. */
  first: Vec;
  second: Vec;
  names: [string, string];
  /** Per component, such as "(−1) · (−2) − 3 · 4 = −10", the middle one with its sign turned. */
  lines: string[];
  result: Vec;
  /** The result dotted with each factor, both 0. */
  checkLines: [string, string];
  /** second × first, for the order beat. */
  flipped: Vec;
  mistake?: CrossMistake;
  student?: Surd[];
  /** The student's answer dotted with the first factor, which is not 0 on V22. */
  studentCheck?: string;
  try?: TryChoice;
}

// ---- area_volume

export type AreaBeat =
  'compare' | 'shape' | 'cross' | 'norm' | 'half' | 'base' | 'dot' | 'abs' | 'tilt' | 'try' | 'end';

export type AreaMode = 'parallelogram' | 'triangle' | 'box';

export type AreaMistake = 'dot' | 'no_half' | 'signed' | 'product';

export interface AreaVolumeParams {
  mode: AreaMode;
  /** The edges from one corner: u, v (and w for a box). */
  edges: Vec[];
  names: string[];
  /** The triangle's corner A, whose sides the edges are. */
  corner?: Vec;
  sidesLine?: string;
  /** u × v, or v × w on a box. */
  cross: Vec;
  crossLine: string;
  /** |u × v| on an area, worked out to its simplest form. */
  normLine?: string;
  area?: Surd;
  halfLine?: string;
  /** u · (v × w) and its absolute value. */
  dotLine?: string;
  triple?: Rational;
  volume?: Rational;
  /** |u||v||w| of the box, for V26. */
  productLine?: string;
  mistake?: AreaMistake;
  wrongLine?: string;
  student?: string;
  /** The answer, as the student would type it. */
  right: string;
  try?: TryChoice;
}

// ---- the template map

export interface VectorBeatsByTemplate {
  quantity_sort: QuantityBeat;
  arrow_chain: ArrowChainBeat;
  component_steps: ComponentBeat;
  parallel_scale: ParallelBeat;
  magnitude_box: MagnitudeBeat;
  unit_shrink: UnitBeat;
  dot_pairs: DotBeat;
  angle_fan: AngleBeat;
  cross_cover: CrossBeat;
  area_volume: AreaBeat;
}

export interface VectorParamsByTemplate {
  quantity_sort: QuantitySortParams;
  arrow_chain: ArrowChainParams;
  component_steps: ComponentStepsParams;
  parallel_scale: ParallelScaleParams;
  magnitude_box: MagnitudeBoxParams;
  unit_shrink: UnitShrinkParams;
  dot_pairs: DotPairsParams;
  angle_fan: AngleFanParams;
  cross_cover: CrossCoverParams;
  area_volume: AreaVolumeParams;
}

/** The ten templates of VECTORS §5. Reveal clips use the shared `worked_solution`. */
export type VectorTemplate = keyof VectorBeatsByTemplate;

export interface VectorSceneOf<T extends VectorTemplate> {
  template: T;
  params: VectorParamsByTemplate[T];
  beats: VectorBeatsByTemplate[T][];
  /** Filled in Thai, at most two lines at 360px. */
  captions: Partial<Record<VectorBeatsByTemplate[T], string>>;
  /** Length of each beat, at least its recorded line. Their sum is the scene's length (SCENES §1). */
  beatMs: Partial<Record<VectorBeatsByTemplate[T], number>>;
  voice: Partial<Record<VectorBeatsByTemplate[T], VoiceId>>;
  waits?: VectorBeatsByTemplate[T][];
  hints?: Partial<Record<VectorBeatsByTemplate[T], ClipHint>>;
  compare?: { studentAnswer: Answer; variant?: string };
  flagged?: VectorBeatsByTemplate[T];
  purpose: ScenePurpose;
}

/** Every clip a vector pack draws with its own templates. */
export type VectorTemplateScene = { [T in VectorTemplate]: VectorSceneOf<T> }[VectorTemplate];
