import type { Rational } from './rational';

export type Level = 1 | 2 | 3;

export type Matrix = Rational[][];

export interface Dims {
  rows: number;
  cols: number;
}

export type ItemKind =
  'matrix' | 'matrix_or_undefined' | 'scalar' | 'cell' | 'dims' | 'dims_or_undefined' | 'choice';

/** A student's answer, or an answer key. `cell` items answer with `scalar`. */
export type Answer =
  | { kind: 'matrix'; value: Matrix }
  | { kind: 'scalar'; value: Rational }
  | { kind: 'dims'; rows: number; cols: number }
  | { kind: 'choice'; id: string }
  | { kind: 'undefined' };

/** Matches whatever matrix the student entered (M04: any matrix means they think A + B exists). */
export const ANY_MATRIX = { kind: 'any_matrix' } as const;

export type DiagnosticAnswer = Answer | typeof ANY_MATRIX;

export interface Diagnostic {
  id: string;
  variant?: string;
  answer: DiagnosticAnswer;
}

export type Classification =
  | { type: 'correct' }
  | { type: 'misconception'; id: string; variant?: string }
  /** Exactly one wrong cell, 1-based. */
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
