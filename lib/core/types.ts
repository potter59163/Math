import type { Rational } from './rational';
import type { Surd } from './surd';

export type Level = 1 | 2 | 3;

export type Matrix = Rational[][];

export interface Dims {
  rows: number;
  cols: number;
}

export type ItemKind =
  | 'matrix'
  | 'matrix_or_undefined'
  | 'scalar'
  | 'cell'
  | 'dims'
  | 'dims_or_undefined'
  | 'choice'
  /** One box that also takes √, such as 3√2 (docs/VECTORS.md §3.3). */
  | 'surd'
  /** A column of 2 or 3 boxes, each taking √. */
  | 'vector';

/** A student's answer, or an answer key. `cell` items answer with `scalar`. */
export type Answer =
  | { kind: 'matrix'; value: Matrix }
  | { kind: 'scalar'; value: Rational }
  | { kind: 'dims'; rows: number; cols: number }
  | { kind: 'choice'; id: string }
  | { kind: 'surd'; value: Surd }
  | { kind: 'vector'; value: Surd[] }
  | { kind: 'undefined' };

/** Matches whatever matrix the student entered (M04: any matrix means they think A + B exists). */
export const ANY_MATRIX = { kind: 'any_matrix' } as const;

export type DiagnosticAnswer = Answer | typeof ANY_MATRIX;

export interface Diagnostic {
  id: string;
  variant?: string;
  answer: DiagnosticAnswer;
  /**
   * Allowed to differ from the correct vector in one component, which rule 3 otherwise forbids.
   * Only for a misconception whose mistake is one sign by nature (V20); its topic rules check that.
   */
  oneOff?: true;
}

export type Classification =
  | { type: 'correct' }
  | { type: 'misconception'; id: string; variant?: string }
  /** Exactly one wrong cell, 1-based. A vector component i is cell [i, 1]. */
  | { type: 'slip'; cell: [number, number] }
  | { type: 'shape_error' }
  | { type: 'unknown' };

/** Enough to rebuild an item exactly: regenerate(ref) always returns the same item. */
export interface ItemRef {
  topic: string;
  skill: string;
  difficulty: Level;
  seed: number;
  /** Misconception this item probes. */
  target?: string;
  /** Narrows the probe to one variant of `target`, which some levels cannot show (MISCONCEPTIONS §4.1). */
  targetVariant?: string;
  gv: number;
}

export interface ChoiceOption {
  id: string;
  labelKey: string;
}

export interface PromptRef {
  key: string;
  params?: Record<string, string>;
}

export interface Item<TData = unknown> {
  ref: ItemRef;
  kind: ItemKind;
  prompt: PromptRef;
  data: TData;
  /** Answer grid size, given for matrix kinds. */
  grid?: Dims;
  options?: ChoiceOption[];
  correct: Answer;
  /** Target first, then catalog order. classify stops at the first match. */
  diagnostics: Diagnostic[];
}
