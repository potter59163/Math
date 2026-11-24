import type { Surd } from './surd';
import type { Answer, Classification, DiagnosticAnswer, Item, Matrix } from './types';

function sameShape(a: Matrix, b: Matrix): boolean {
  return a.length === b.length && a.every((row, i) => row.length === b[i].length);
}

/** Number of components where two same-length vectors differ, or null when the lengths differ. */
export function countDiffComponents(a: Surd[], b: Surd[]): number | null {
  if (a.length !== b.length) return null;
  return a.filter((part, i) => !part.equals(b[i])).length;
}

/** Number of cells where two same-shape matrices differ, or null when the shapes differ. */
export function countDiffCells(a: Matrix, b: Matrix): number | null {
  if (!sameShape(a, b)) return null;
  let count = 0;
  a.forEach((row, i) => {
    row.forEach((cell, j) => {
      if (!cell.equals(b[i][j])) count += 1;
    });
  });
  return count;
}

export function answersEqual(a: Answer, b: Answer): boolean {
  switch (a.kind) {
    case 'matrix':
      return b.kind === 'matrix' && countDiffCells(a.value, b.value) === 0;
    case 'scalar':
      return b.kind === 'scalar' && a.value.equals(b.value);
    case 'dims':
      return b.kind === 'dims' && a.rows === b.rows && a.cols === b.cols;
    case 'choice':
      return b.kind === 'choice' && a.id === b.id;
    case 'surd':
      return b.kind === 'surd' && a.value.equals(b.value);
    case 'vector':
      return b.kind === 'vector' && countDiffComponents(a.value, b.value) === 0;
    case 'undefined':
      return b.kind === 'undefined';
  }
}

export function matchesDiagnostic(expected: DiagnosticAnswer, answer: Answer): boolean {
  if (expected.kind === 'any_matrix') return answer.kind === 'matrix';
  return answersEqual(expected, answer);
}

/** True when some student answer would match both. ANY_MATRIX overlaps every matrix. */
export function diagnosticsCollide(a: DiagnosticAnswer, b: DiagnosticAnswer): boolean {
  if (a.kind === 'any_matrix') return b.kind === 'any_matrix' || b.kind === 'matrix';
  return matchesDiagnostic(b, a);
}

function firstWrongCell(a: Matrix, b: Matrix): [number, number] {
  for (let i = 0; i < a.length; i += 1) {
    for (let j = 0; j < a[i].length; j += 1) {
      if (!a[i][j].equals(b[i][j])) return [i + 1, j + 1];
    }
  }
  throw new Error('classify: matrices are equal');
}

/** Order from MISCONCEPTIONS §1: correct → diagnostics → slip → shape_error → unknown. */
export function classify(item: Item, answer: Answer): Classification {
  if (answersEqual(answer, item.correct)) return { type: 'correct' };

  for (const diagnostic of item.diagnostics) {
    if (matchesDiagnostic(diagnostic.answer, answer)) {
      return diagnostic.variant === undefined
        ? { type: 'misconception', id: diagnostic.id }
        : { type: 'misconception', id: diagnostic.id, variant: diagnostic.variant };
    }
  }

  if (item.kind === 'matrix' || item.kind === 'matrix_or_undefined') {
    const { correct } = item;
    if (answer.kind === 'undefined') return { type: 'shape_error' };
    if (answer.kind === 'matrix') {
      if (correct.kind !== 'matrix') return { type: 'shape_error' };
      const wrong = countDiffCells(answer.value, correct.value);
      if (wrong === null) return { type: 'shape_error' };
      if (wrong === 1) return { type: 'slip', cell: firstWrongCell(answer.value, correct.value) };
    }
  }

  if (item.kind === 'vector' && item.correct.kind === 'vector') {
    const expected = item.correct.value;
    if (answer.kind !== 'vector') return { type: 'shape_error' };
    const wrong = countDiffComponents(answer.value, expected);
    if (wrong === null) return { type: 'shape_error' };
    if (wrong === 1) {
      const i = answer.value.findIndex((part, k) => !part.equals(expected[k]));
      return { type: 'slip', cell: [i + 1, 1] };
    }
  }

  return { type: 'unknown' };
}
