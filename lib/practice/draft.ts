import { parseAnswer, type ParseFailure, type RawAnswer } from '@/lib/core/parse';
import type { Answer, Item } from '@/lib/core/types';

// What the student has typed so far, and how each keypad press changes it. Pure, so the keypad and a
// physical keyboard share one set of rules and tests can drive it key by key.

export type KeypadChar =
  '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '-' | '/' | '.';
export type KeypadKey = KeypadChar | 'backspace' | 'next';
export type Direction = 'left' | 'right' | 'up' | 'down';

export type DraftItem = Pick<Item, 'kind' | 'grid'>;

export interface Draft {
  /** One string per box: matrix cells row by row, one box for a number, two for dimensions. */
  cells: string[];
  active: number;
  choice: string | null;
  isUndefined: boolean;
}

export type NotReadyReason = 'incomplete' | 'invalid' | 'zero_denominator';

export type Readiness =
  { ready: true; answer: Answer } | { ready: false; reason: NotReadyReason; box: number | null };

/** The most a box can show at 360px. */
const MAX_NUMBER_CHARS = 8;
const MAX_DIMENSION_DIGITS = 2;

const isMatrixKind = ({ kind }: DraftItem) => kind === 'matrix' || kind === 'matrix_or_undefined';
const isDimsKind = ({ kind }: DraftItem) => kind === 'dims' || kind === 'dims_or_undefined';

function gridOf(item: DraftItem) {
  if (!item.grid) throw new Error(`draft: ${item.kind} item has no grid`);
  return item.grid;
}

function boxCount(item: DraftItem): number {
  if (isMatrixKind(item)) return gridOf(item).rows * gridOf(item).cols;
  if (isDimsKind(item)) return 2;
  return item.kind === 'choice' ? 0 : 1;
}

function columnsOf(item: DraftItem): number {
  if (isMatrixKind(item)) return gridOf(item).cols;
  return isDimsKind(item) ? 2 : 1;
}

export function emptyDraft(item: DraftItem): Draft {
  return {
    cells: Array.from({ length: boxCount(item) }, () => ''),
    active: 0,
    choice: null,
    isUndefined: false,
  };
}

/** What the boxes showed when this answer was sent, for a closed item after a reload. */
export function draftFromAnswer(item: DraftItem, answer: Answer): Draft {
  const draft = emptyDraft(item);
  switch (answer.kind) {
    case 'matrix':
      return { ...draft, cells: answer.value.flat().map((cell) => cell.toString()) };
    case 'scalar':
      return { ...draft, cells: [answer.value.toString()] };
    case 'dims':
      return { ...draft, cells: [String(answer.rows), String(answer.cols)] };
    case 'choice':
      return { ...draft, choice: answer.id };
    case 'undefined':
      return { ...draft, isUndefined: true };
  }
}

function typeNumber(text: string, char: KeypadChar): string {
  const atLimit = text.length >= MAX_NUMBER_CHARS;
  if (char === '-') {
    if (text.startsWith('-')) return text.slice(1);
    return atLimit ? text : `-${text}`;
  }
  if (atLimit) return text;
  if (char === '/') return /\d/.test(text) && !/[/.]/.test(text) ? `${text}/` : text;
  if (char === '.') {
    if (/[/.]/.test(text)) return text;
    return /\d$/.test(text) ? `${text}.` : `${text}0.`;
  }
  return text + char;
}

function typeDimension(text: string, char: KeypadChar): string {
  return /\d/.test(char) && text.length < MAX_DIMENSION_DIGITS ? text + char : text;
}

function withText(draft: Draft, text: string): Draft {
  const cells = draft.cells.map((cell, index) => (index === draft.active ? text : cell));
  return { ...draft, cells, isUndefined: false };
}

export function pressKey(draft: Draft, item: DraftItem, key: KeypadKey): Draft {
  if (draft.cells.length === 0) return draft;

  if (key === 'next') return { ...draft, active: (draft.active + 1) % draft.cells.length };

  const text = draft.cells[draft.active];
  if (key === 'backspace') {
    if (text !== '') return withText(draft, text.slice(0, -1));
    return draft.active > 0 ? { ...draft, active: draft.active - 1 } : draft;
  }

  const typed = isDimsKind(item) ? typeDimension(text, key) : typeNumber(text, key);
  return typed === text ? draft : withText(draft, typed);
}

export function focusBox(draft: Draft, box: number): Draft {
  return { ...draft, active: box };
}

export function moveActive(draft: Draft, item: DraftItem, direction: Direction): Draft {
  const cols = columnsOf(item);
  const { active, cells } = draft;
  const column = active % cols;
  const target = {
    left: column > 0 ? active - 1 : active,
    right: column < cols - 1 ? active + 1 : active,
    up: active - cols >= 0 ? active - cols : active,
    down: active + cols < cells.length ? active + cols : active,
  }[direction];
  return { ...draft, active: target };
}

export function pickChoice(draft: Draft, id: string): Draft {
  return { ...draft, choice: id };
}

export function toggleUndefined(draft: Draft): Draft {
  return { ...draft, isUndefined: !draft.isUndefined };
}

function toRaw(item: DraftItem, draft: Draft): RawAnswer | null {
  if (draft.isUndefined) return { type: 'undefined' };
  if (isMatrixKind(item)) {
    const { rows, cols } = gridOf(item);
    const cells = Array.from({ length: rows }, (_, i) =>
      draft.cells.slice(i * cols, (i + 1) * cols),
    );
    return { type: 'matrix', cells };
  }
  if (isDimsKind(item)) return { type: 'dims', rows: draft.cells[0], cols: draft.cells[1] };
  if (item.kind === 'choice') {
    return draft.choice === null ? null : { type: 'choice', id: draft.choice };
  }
  return { type: 'number', text: draft.cells[0] };
}

const REASONS: Record<ParseFailure, NotReadyReason> = {
  empty: 'incomplete',
  invalid: 'invalid',
  zero_denominator: 'zero_denominator',
  too_large: 'invalid',
  wrong_kind: 'invalid',
};

function failingBox(item: DraftItem, draft: Draft, cell?: [number, number]): number {
  if (cell) return (cell[0] - 1) * columnsOf(item) + (cell[1] - 1);
  if (!isDimsKind(item)) return 0;
  const rowsAlone = parseAnswer(item.kind, { type: 'dims', rows: draft.cells[0], cols: '1' });
  return rowsAlone.ok ? 1 : 0;
}

/** Whether the draft can be sent. SPEC §5: sending stays off until every box is filled. */
export function readiness(item: DraftItem, draft: Draft): Readiness {
  const raw = toRaw(item, draft);
  if (raw === null) return { ready: false, reason: 'incomplete', box: null };
  const parsed = parseAnswer(item.kind, raw);
  if (parsed.ok) return { ready: true, answer: parsed.value };
  return {
    ready: false,
    reason: REASONS[parsed.reason],
    box: failingBox(item, draft, parsed.cell),
  };
}

/** A box's text as the student should see it, with a typographic minus. */
export function boxText(text: string): string {
  return text.replace('-', '−');
}
