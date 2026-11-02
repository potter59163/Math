import type { Rational } from '@/lib/core/rational';
import type { Answer, Dims, Matrix } from '@/lib/core/types';
import type { VoiceId } from './voice';

// SceneSpec of docs/SCENES.md §2. Every number a template draws is worked out here by the engine, so
// a template only places what it is given. Rationals print as "-3/2" in JSON, so a spec can be logged.

export type ScenePurpose = 'intro' | 'concept' | 'remediate' | 'request' | 'reveal';

/** 1-based, like the rest of the matrix copy. */
export type CellIndex = [row: number, col: number];

export interface PairTerm {
  a: Rational;
  b: Rational;
  product: Rational;
}

export type RowColVariant = 'elementwise' | 'row_row' | 'col_col' | 'reversed';

export type RowColBeat =
  | 'compare'
  | 'setup'
  | 'pick_row'
  | 'pick_col'
  | 'pair'
  | 'only_first'
  | 'multiply'
  | 'sum'
  | 'place'
  | 'try_row'
  | 'try_col'
  | 'try_done'
  | 'fill_rest'
  | 'end';

/** The bill a row and a column make, when their numbers can be counted (SCENES §3.1). */
export interface RowColStory {
  who: string;
  labels: { qty: string; price: string; result: string };
  items: readonly string[];
}

/** What the wrong method did at this cell: the cells it read and the value it reached. */
export interface WrongWork {
  variant: RowColVariant;
  leftCells: CellIndex[];
  rightCells: CellIndex[];
  terms: PairTerm[];
  value: Rational;
}

export interface RowColDotParams {
  /** In the order the item asks for, so a BA item has B on the left. */
  left: Matrix;
  right: Matrix;
  product: Matrix;
  names: { left: string; right: string; result: string };
  cell: CellIndex;
  /** Row of `left` paired with column of `right` at `cell`. */
  terms: PairTerm[];
  wrong?: WrongWork;
  /** What the student answered, marked as the clip goes. */
  student?: Matrix;
  story?: RowColStory;
  /** Another cell, for the student to find the row and column of. */
  tryCell?: CellIndex;
  tryTerms?: PairTerm[];
}

export type DimensionBeat =
  'compare' | 'blocks' | 'count_rows' | 'count_cols' | 'check' | 'result' | 'try' | 'try_done';

/** A quick question that closes a clip about a mistake: tapping the right one moves on. */
export interface TryChoice {
  options: string[];
  right: number;
}

export interface DimensionTry extends TryChoice {
  first: Dims;
  second?: Dims;
  names?: { first: string; second: string };
  values?: Matrix;
}

export type DimensionOp = 'single' | 'add' | 'mult';

export interface DimensionMatchParams {
  op: DimensionOp;
  first: Dims;
  second?: Dims;
  names: { first: string; second?: string };
  /** Single mode draws the real cells. */
  values?: Matrix;
  labels?: { rows: readonly string[]; cols: readonly string[] };
  /** Mult: the inner numbers match. Add: the dims match. Single: always true. */
  fits: boolean;
  /** Null when it cannot be computed. */
  result: Dims | null;
  student?: Dims | 'undefined';
  try?: DimensionTry;
}

export type GridMode = 'det_area' | 'det_zero' | 'scale_k' | 'compose' | 'undo';

export type GridBeat =
  | 'compare'
  | 'unit'
  | 'apply'
  | 'area'
  | 'flip'
  | 'cant_undo'
  | 'scale'
  | 'cube'
  | 'first'
  | 'second'
  | 'differ'
  | 'undo'
  | 'back'
  | 'try'
  | 'try_done';

export interface GridBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface GridTransformParams {
  mode: GridMode;
  /** Matrices named on screen, each from the beat it first matters. */
  shown: { label: string; value: Matrix; from: GridBeat }[];
  /** Panel titles, for the two frames of compose. */
  panels?: string[];
  /** Each panel's transform at the end of each beat. A beat animates from the frame before it. */
  frames: Partial<Record<GridBeat, Matrix[]>>;
  /** Holds every corner of every frame, in grid units. */
  bounds: GridBounds;
  /** Words written over the picture on a beat, such as how many times the area grew. */
  marks: Partial<Record<GridBeat, string>>;
  try?: TryChoice;
}

export type InverseBeat =
  'show' | 'swap' | 'negate' | 'det' | 'divide' | 'check' | 'try' | 'try_done';

export type InverseVariant =
  'NO_SWAP' | 'NO_NEGATE' | 'NO_DIVIDE' | 'TIMES_DET' | 'TRANSPOSED' | 'RECIPROCAL';

export interface InverseRecipeParams {
  A: Matrix;
  /** a and d swapped: [[d, b], [c, a]]. */
  swapped: Matrix;
  /** [[d, −b], [−c, a]]. */
  adjugate: Matrix;
  ad: Rational;
  bc: Rational;
  det: Rational;
  inverse: Matrix;
  /** A·A⁻¹, for the optional check beat. */
  identity: Matrix;
  variant?: InverseVariant;
  student?: Matrix;
  try?: TryChoice;
}

export type WorkedBeat = `step_${number}`;

export interface WorkedSceneStep {
  text: string;
  latex: string;
  /** The beat that reveals this step. Earlier steps stay on screen. */
  beat: WorkedBeat;
}

export interface WorkedSolutionParams {
  steps: WorkedSceneStep[];
}

export type CellBeat = 'compare' | 'row' | 'col' | 'hit' | 'try' | 'try_done';

export interface CellLocatorParams {
  A: Matrix;
  /** 1-based, as the item asks for aᵢⱼ. */
  i: number;
  j: number;
  name: string;
  value: Rational;
  /** aⱼᵢ, the cell M02 reads instead, and the one the student then has to find. */
  swapped?: { name: string; value: Rational };
}

export type TransposeBeat = 'compare' | 'setup' | `row_${number}` | 'try' | 'done';

export type TransposeVariant = 'ROT_CW' | 'ROT_CCW' | 'ANTI' | 'FLIP_H' | 'FLIP_V' | 'SAME';

export interface TransposeFlipParams {
  A: Matrix;
  transposed: Matrix;
  variant?: TransposeVariant;
  student?: Matrix;
}

export type SarrusBeat = 'copy' | 'compare' | 'down' | 'try' | 'up' | 'result';

export type SarrusVariant =
  'ALL_PLUS' | 'NO_ALT_SIGN' | 'TWO_DIAG' | 'ADD' | 'REVERSE' | 'PAIRS_ROW' | 'PAIRS_COL';

export interface SarrusParams {
  A: Matrix;
  size: 2 | 3;
  /** Products along the lines. Each index starts one column further right. */
  down: Rational[];
  up: Rational[];
  downSum: Rational;
  upSum: Rational;
  det: Rational;
  /** What the wrong formula computes on these numbers, already written out. */
  wrong?: { variant: SarrusVariant; value: Rational; expression: string };
  try?: TryChoice;
}

export type CellByCellOp = 'add' | 'sub' | 'scalar';

export type CellByCellBeat =
  'compare' | 'setup' | `cell_${number}` | 'try' | 'try_done' | 'rest' | 'done' | 'also';

export interface CellWork {
  /** 1-based, like the rest of the matrix copy. */
  i: number;
  j: number;
  a: Rational;
  b?: Rational;
  value: Rational;
  /** Already written out, such as "3 + 5 = 8". */
  expression: string;
}

export interface CellByCellParams {
  op: CellByCellOp;
  left: Matrix;
  right?: Matrix;
  k?: Rational;
  result: Matrix;
  names: { left: string; right?: string; result: string };
  /** Every cell, the first ones being those worked out in full. */
  work: CellWork[];
  cellsInFull: number;
  student?: Matrix;
  variant?: string;
  also?: { k: Rational; result: Matrix };
  /** About the second cell of `work`. */
  try?: TryChoice;
}

export type DetSumBeat = 'compare' | 'try' | 'add_first' | 'det_of_sum' | 'differ';

export interface DetSumParams {
  A: Matrix;
  B: Matrix;
  sum: Matrix;
  wrongLine: string;
  rightLine: string;
  detSum: Rational;
  wrong: Rational;
  try?: TryChoice;
}

export interface BeatsByTemplate {
  cell_by_cell: CellByCellBeat;
  det_sum: DetSumBeat;
  row_col_dot: RowColBeat;
  dimension_match: DimensionBeat;
  grid_transform: GridBeat;
  inverse_recipe: InverseBeat;
  worked_solution: WorkedBeat;
  cell_locator: CellBeat;
  transpose_flip: TransposeBeat;
  sarrus: SarrusBeat;
}

export interface ParamsByTemplate {
  cell_by_cell: CellByCellParams;
  det_sum: DetSumParams;
  row_col_dot: RowColDotParams;
  dimension_match: DimensionMatchParams;
  grid_transform: GridTransformParams;
  inverse_recipe: InverseRecipeParams;
  worked_solution: WorkedSolutionParams;
  cell_locator: CellLocatorParams;
  transpose_flip: TransposeFlipParams;
  sarrus: SarrusParams;
}

export type TemplateId = keyof BeatsByTemplate;

export interface SceneSpecOf<T extends TemplateId> {
  template: T;
  params: ParamsByTemplate[T];
  beats: BeatsByTemplate[T][];
  /** Filled in Thai, one line each at 360px. Worked steps carry their own text instead. */
  captions: Partial<Record<BeatsByTemplate[T], string>>;
  /** Length of each beat, at least its recorded line. Their sum is the scene's length (SCENES §1). */
  beatMs: Partial<Record<BeatsByTemplate[T], number>>;
  /** What is said on each beat. */
  voice: Partial<Record<BeatsByTemplate[T], VoiceId>>;
  /** Beats that wait for the student to tap, which do not count towards the scene's length. */
  waits?: BeatsByTemplate[T][];
  /** What a wrong tap on a waiting beat gets. */
  hints?: Partial<Record<BeatsByTemplate[T], ClipHint>>;
  compare?: { studentAnswer: Answer; variant?: string };
  /** The beat a compare scene points at, marked on the progress dots. */
  flagged?: BeatsByTemplate[T];
  purpose: ScenePurpose;
}

export interface ClipHint {
  caption: string;
  voice: VoiceId;
}

export type SceneSpec = { [T in TemplateId]: SceneSpecOf<T> }[TemplateId];

/** A spec with its beats as plain strings, for code that treats every template alike. */
export interface AnyScene {
  template: TemplateId;
  beats: readonly string[];
  captions: Partial<Record<string, string>>;
  beatMs: Partial<Record<string, number>>;
  voice: Partial<Record<string, VoiceId>>;
  waits?: readonly string[];
  hints?: Partial<Record<string, ClipHint>>;
  flagged?: string;
  purpose: ScenePurpose;
}
