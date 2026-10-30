import type { Answer, Classification, DiagnosticAnswer, Item, Matrix } from './types';

function sameShape(a: Matrix, b: Matrix): boolean {
  return a.length === b.length && a.every((row, i) => row.length === b[i].length);
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

  return { type: 'unknown' };
}
