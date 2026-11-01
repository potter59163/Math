import { Rational } from './rational';
import type { Answer } from './types';

/** An Answer that survives JSON, as `attempts.answer` and a reload both need (SPEC §13). */
export type StoredAnswer =
  | { kind: 'matrix'; value: string[][] }
  | { kind: 'scalar'; value: string }
  | { kind: 'dims'; rows: number; cols: number }
  | { kind: 'choice'; id: string }
  | { kind: 'undefined' };

export function storeAnswer(answer: Answer): StoredAnswer {
  switch (answer.kind) {
    case 'matrix':
      return {
        kind: 'matrix',
        value: answer.value.map((row) => row.map((cell) => cell.toString())),
      };
    case 'scalar':
      return { kind: 'scalar', value: answer.value.toString() };
    default:
      return answer;
  }
}

export function restoreAnswer(stored: StoredAnswer): Answer {
  switch (stored.kind) {
    case 'matrix':
      return {
        kind: 'matrix',
        value: stored.value.map((row) => row.map((cell) => Rational.parse(cell))),
      };
    case 'scalar':
      return { kind: 'scalar', value: Rational.parse(stored.value) };
    default:
      return stored;
  }
}
