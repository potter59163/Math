import type { VectorChoiceKey, VectorPromptKey } from '@/lib/content/th.vector';
import type { Rng } from '@/lib/core/prng';
import type { Rational } from '@/lib/core/rational';
import type { Surd } from '@/lib/core/surd';
import type {
  Answer,
  ChoiceOption,
  Diagnostic,
  Dims,
  ItemKind,
  ItemRef,
  Level,
} from '@/lib/core/types';
import type { SkillId } from './skills';

/** A 2D or 3D vector, or a point given by its coordinates. Givens are integers. */
export type Vec = Rational[];

/** The kinds a vector item can be (docs/VECTORS.md §2). */
export type VectorItemKind = Extract<ItemKind, 'choice' | 'scalar' | 'surd' | 'vector'>;

/** An answer key of a vector item. Students can still type any Answer. */
export type VectorAnswer = Extract<Answer, { kind: 'choice' | 'scalar' | 'surd' | 'vector' }>;

/** The 26 misconceptions of docs/VECTORS.md §4, in catalog order. */
export type MisconceptionId =
  | 'V01_QUANTITY_MIX'
  | 'V02_EQUAL_IGNORES_DIRECTION'
  | 'V03_GEOM_SUB_DIRECTION'
  | 'V04_GEOM_ADD_JOIN_TIPS'
  | 'V05_POINTS_REVERSED'
  | 'V06_SCALAR_PARTIAL'
  | 'V07_COMBO_SIGN'
  | 'V08_PARALLEL_RATIO_FLIP'
  | 'V09_MAG_NO_ROOT'
  | 'V10_MAG_SUM_COMPONENTS'
  | 'V11_MAG_ADDITIVE'
  | 'V12_UNIT_SQUARED'
  | 'V13_UNIT_DIVIDE_SUM'
  | 'V14_DOT_AS_DET'
  | 'V15_DOT_NO_COS'
  | 'V16_DOT_SIN'
  | 'V17_ANGLE_ABS'
  | 'V18_ANGLE_SQUARED_NORMS'
  | 'V19_PERP_AS_PARALLEL'
  | 'V20_CROSS_MIDDLE_SIGN'
  | 'V21_CROSS_ORDER'
  | 'V22_CROSS_COMPONENTWISE'
  | 'V23_TRIANGLE_NO_HALF'
  | 'V24_AREA_DOT'
  | 'V25_VOLUME_SIGNED'
  | 'V26_VOLUME_MAG_PRODUCT';

/** The only angles an item may ask for or give (docs/VECTORS.md §2). */
export const STANDARD_ANGLES = [0, 30, 45, 60, 90, 120, 135, 150, 180] as const;
export type Angle = (typeof STANDARD_ANGLES)[number];

/** Physical quantities for v_quantity L1. Each is a choice key `q_<name>`. */
export type Quantity =
  | 'velocity'
  | 'speed'
  | 'displacement'
  | 'distance'
  | 'weight'
  | 'mass'
  | 'force'
  | 'acceleration'
  | 'momentum'
  | 'temperature'
  | 'time'
  | 'volume'
  | 'energy'
  | 'area';

/** Point names in a geometry figure. */
export type PointLabel = 'A' | 'B' | 'C' | 'D' | 'M' | 'N';

/** The scales a figure option can carry, as written in its choice key. */
export type ScaleKey = '' | '2' | '1/2';

/** A choice key naming one vector of a figure, such as "DC", "2MN" or "1/2BC". */
export type FigureKey = `${ScaleKey}${PointLabel}${PointLabel}`;

/** k·(from→to). In an option k is 1, 2 or ½; in an expression it may also be negative. */
export interface Term {
  k: Rational;
  from: PointLabel;
  to: PointLabel;
}

export interface FigurePoint {
  label: PointLabel;
  /** Hidden integer coordinates. The student never sees them; the UI draws from them. */
  at: [number, number];
}

/** A figure for the geometry items, described fully enough for the UI to draw it. */
export interface Figure {
  shape: 'parallelogram' | 'triangle';
  /** The polygon, in drawing order. */
  outline: PointLabel[];
  points: FigurePoint[];
  midpoints: { label: PointLabel; of: [PointLabel, PointLabel] }[];
}

export type VecName = 'u' | 'v' | 'w';

/** k·vec in an expression such as 3u − 2v. The sign of k is the sign written before the term. */
export interface LinearTerm {
  k: number;
  name: VecName;
  vec: Vec;
}

export type Unknown = 'k' | 'm' | 'n';

/** A component that is either given or an unknown the student solves for. */
export type Slot = Rational | Unknown;

/** What the item shows the student. */
export type VectorData =
  /** "Which is a vector (or scalar) quantity?" */
  | { form: 'quantity_kind'; ask: 'vector' | 'scalar'; options: Quantity[] }
  /** "Which vector equals `of`?" or, when `negative`, "Which is the negative of `of`?" */
  | { form: 'figure_equal'; figure: Figure; of: Term; negative: boolean; options: Term[] }
  /** "What does `expr` equal?" */
  | { form: 'figure_expr'; figure: Figure; expr: Term[]; options: Term[] }
  /** Asks for the vector AB. */
  | { form: 'points'; A: Vec; B: Vec }
  /** Asks for the point D that makes ABCD a parallelogram. */
  | { form: 'fourth_vertex'; A: Vec; B: Vec; C: Vec }
  | { form: 'linear'; terms: LinearTerm[]; notation: 'tuple' | 'ijk' }
  /** u ∥ v, asks for `ask`. */
  | { form: 'parallel'; u: Slot[]; v: Slot[]; ask: 'm' | 'n' }
  | { form: 'magnitude'; v: Vec }
  /** |pu + qv|. */
  | { form: 'magnitude_combo'; terms: LinearTerm[] }
  | { form: 'distance'; A: Vec; B: Vec }
  | { form: 'unit'; v: Vec }
  /** The vector of this length in the direction of v. */
  | { form: 'scaled_unit'; v: Vec; length: number }
  | { form: 'direction_cosines'; v: Vec }
  | { form: 'dot'; u: Vec; v: Vec }
  /** u·v from |u|, |v| and the angle between them. */
  | { form: 'dot_polar'; normU: Surd; normV: Surd; theta: Angle }
  /** Asks for cos θ. */
  | { form: 'cos_angle'; u: Vec; v: Vec }
  /** Asks for θ in degrees. `theta` came first and u, v were built to fit it (rule 6 re-checks). */
  | { form: 'angle'; u: Vec; v: Vec; theta: Angle }
  /** u ⊥ v, asks for k. */
  | { form: 'perp'; u: Slot[]; v: Slot[] }
  /** (u + v) ⊥ (u − v), asks for the positive k in v. */
  | { form: 'perp_property'; u: Vec; v: Slot[] }
  | { form: 'cross'; u: Vec; v: Vec; order: 'uv' | 'vu' }
  | { form: 'area_parallelogram'; u: Vec; v: Vec }
  | { form: 'area_triangle'; A: Vec; B: Vec; C: Vec }
  | { form: 'volume'; u: Vec; v: Vec; w: Vec };

export type FormId = VectorData['form'];
export type DataOf<F extends FormId> = Extract<VectorData, { form: F }>;

export interface VectorItemRef extends ItemRef {
  topic: 'vector';
  skill: SkillId;
  target?: MisconceptionId;
}

export interface VectorChoiceOption extends ChoiceOption {
  id: VectorChoiceKey;
  labelKey: VectorChoiceKey;
}

/** Everything about an item except its identity and diagnostics. */
export interface ItemBody {
  kind: VectorItemKind;
  prompt: { key: VectorPromptKey; params?: Record<string, string> };
  data: VectorData;
  grid?: Dims;
  options?: VectorChoiceOption[];
  correct: VectorAnswer;
}

export interface VectorDiagnostic extends Diagnostic {
  id: MisconceptionId;
}

export interface VectorItem extends ItemBody {
  ref: VectorItemRef;
  diagnostics: VectorDiagnostic[];
}

export interface GenerateRequest {
  skill: SkillId;
  difficulty: Level;
  seed: number;
  target?: MisconceptionId;
  targetVariant?: string;
}

export interface Probe {
  target?: MisconceptionId;
  targetVariant?: string;
}

/**
 * One per skill. `sample` draws the numbers; `body` works out everything else from them, so tests
 * can feed `body` the documented examples directly.
 */
export interface SkillGenerator {
  sample(rng: Rng, level: Level, probe: Probe): VectorData;
  body(data: VectorData, level: Level): ItemBody;
}
