import type { ChoiceKey, PromptKey } from '@/lib/content/th';
import type { Rng } from '@/lib/core/prng';
import type {
  Answer,
  ChoiceOption,
  Diagnostic,
  Dims,
  ItemKind,
  ItemRef,
  Level,
  Matrix,
} from '@/lib/core/types';
import type { SkillId } from './skills';

/** The ★ misconceptions of docs/MISCONCEPTIONS.md. */
export type MisconceptionId =
  | 'M01_DIM_SWAP'
  | 'M02_INDEX_SWAP'
  | 'M03_TRANSPOSE_WRONG'
  | 'M04_ADD_DIM_MISMATCH'
  | 'M05_SUB_REVERSED'
  | 'M07_SCALAR_PARTIAL'
  | 'M08_MULT_DIM_RULE'
  | 'M09_MULT_ELEMENTWISE'
  | 'M10_MULT_ROW_ROW'
  | 'M11_MULT_COMMUTATIVE'
  | 'M12_DET2_FORMULA'
  | 'M13_DET3_SIGN'
  | 'M14_DET_SCALAR_LINEAR'
  | 'M15_DET_ADDITIVE'
  | 'M18_INV_SINGULAR'
  | 'M19_INV_ZERO_ENTRY'
  | 'M20_INV2_RECIPE'
  | 'M21_INV_RECIPROCAL';

export type NoncommStatement = 'always_equal' | 'may_differ' | 'swap_keeps_product';

export const NONCOMM_STATEMENT_IS_TRUE: Record<NoncommStatement, boolean> = {
  always_equal: false,
  may_differ: true,
  swap_keeps_product: false,
};

/** What the item shows the student. Integers are plain numbers; matrices hold Rationals. */
export type MatrixData =
  | { form: 'dim'; A: Matrix }
  /** Asks for aᵢⱼ, 1-based. */
  | { form: 'index'; A: Matrix; i: number; j: number }
  | { form: 'transpose'; A: Matrix }
  | { form: 'addsub'; op: 'add' | 'sub'; A: Matrix; B: Matrix }
  | { form: 'scalar'; k: number; A: Matrix }
  /** Asks for pA − qB. */
  | { form: 'combo'; p: number; q: number; A: Matrix; B: Matrix }
  | { form: 'mult_defined'; order: 'AB' | 'BA'; dimsA: Dims; dimsB: Dims }
  | { form: 'mult_defined_abc'; dimsA: Dims; dimsB: Dims; dimsC: Dims }
  | { form: 'mult'; A: Matrix; B: Matrix }
  | { form: 'noncomm_statement'; statement: NoncommStatement }
  | { form: 'noncomm_find_ba'; A: Matrix; B: Matrix; AB: Matrix }
  | { form: 'noncomm_pair'; A: Matrix; B: Matrix }
  | { form: 'det2'; A: Matrix }
  | { form: 'det3'; A: Matrix }
  /** Asks for det(kA) given that A is n×n with det(A) = d. */
  | { form: 'det_scaled'; n: number; d: number; k: number }
  /** Asks for det(AB) given det(A) = p and det(B) = q. */
  | { form: 'det_product'; p: number; q: number }
  | { form: 'det_sum'; A: Matrix; B: Matrix }
  | { form: 'det_transpose'; d: number }
  | { form: 'det_inverse'; d: number }
  | { form: 'invertible'; A: Matrix }
  | { form: 'inv2'; A: Matrix };

export type FormId = MatrixData['form'];
export type DataOf<F extends FormId> = Extract<MatrixData, { form: F }>;

export interface MatrixItemRef extends ItemRef {
  topic: 'matrix';
  skill: SkillId;
  target?: MisconceptionId;
}

export interface MatrixChoiceOption extends ChoiceOption {
  id: ChoiceKey;
  labelKey: ChoiceKey;
}

/** Everything about an item except its identity and diagnostics. */
export interface ItemBody {
  kind: ItemKind;
  prompt: { key: PromptKey; params?: Record<string, string> };
  data: MatrixData;
  grid?: Dims;
  options?: MatrixChoiceOption[];
  correct: Answer;
}

export interface MatrixDiagnostic extends Diagnostic {
  id: MisconceptionId;
}

export interface MatrixItem extends ItemBody {
  ref: MatrixItemRef;
  diagnostics: MatrixDiagnostic[];
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
  sample(rng: Rng, level: Level, probe: Probe): MatrixData;
  body(data: MatrixData, level: Level): ItemBody;
}
