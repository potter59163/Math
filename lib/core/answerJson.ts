import { Rational } from './rational';
import { Surd } from './surd';
import type { Answer } from './types';

/** An Answer that survives JSON, as `attempts.answer` and a reload both need (SPEC §13). */
export type StoredAnswer =
  | { kind: 'matrix'; value: string[][] }
  | { kind: 'scalar'; value: string }
  | { kind: 'dims'; rows: number; cols: number }
  | { kind: 'choice'; id: string }
  | { kind: 'surd'; value: string }
  | { kind: 'vector'; value: string[] }
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
    case 'surd':
      return { kind: 'surd', value: answer.value.toString() };
    case 'vector':
      return { kind: 'vector', value: answer.value.map((part) => part.toString()) };
    case 'dims':
    case 'choice':
    case 'undefined':
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
    case 'surd':
      return { kind: 'surd', value: Surd.parse(stored.value) };
    case 'vector':
      return { kind: 'vector', value: stored.value.map((part) => Surd.parse(part)) };
    case 'dims':
    case 'choice':
    case 'undefined':
      return stored;
  }
}
