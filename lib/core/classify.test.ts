import { describe, expect, it } from 'vitest';
import { answersEqual, classify, countDiffCells } from './classify';
import { Rational } from './rational';
import {
  ANY_MATRIX,
  type Answer,
  type Diagnostic,
  type Item,
  type ItemKind,
  type Matrix,
} from './types';

const m = (rows: (number | string)[][]): Matrix =>
  rows.map((row) => row.map((cell) => Rational.parse(String(cell))));
const mat = (rows: (number | string)[][]): Answer => ({ kind: 'matrix', value: m(rows) });
const num = (value: number | string): Answer => ({
  kind: 'scalar',
  value: Rational.parse(String(value)),
});
const UNDEFINED: Answer = { kind: 'undefined' };

function makeItem(kind: ItemKind, correct: Answer, diagnostics: Diagnostic[] = []): Item {
  return {
    ref: { topic: 'test', skill: 'test', difficulty: 1, seed: 0, gv: 1 },
    kind,
    prompt: { key: 'test' },
    data: null,
    correct,
    diagnostics,
  };
}

describe('classify order', () => {
  const correct = mat([
    [1, 2],
    [3, 4],
  ]);

  it('1. correct wins over everything', () => {
    const item = makeItem('matrix', correct, [{ id: 'M1', answer: correct }]);
    expect(classify(item, correct)).toEqual({ type: 'correct' });
  });

  it('1. compares exactly, so an unreduced fraction is correct', () => {
    const item = makeItem('scalar', num('1/2'));
    expect(classify(item, { kind: 'scalar', value: Rational.of(2, 4) })).toEqual({
      type: 'correct',
    });
  });

  it('2. walks diagnostics in the order given and stops at the first match', () => {
    const wrong = mat([
      [9, 9],
      [9, 9],
    ]);
    const item = makeItem('matrix', correct, [
      { id: 'FIRST', variant: 'V', answer: wrong },
      { id: 'SECOND', answer: wrong },
    ]);
    expect(classify(item, wrong)).toEqual({ type: 'misconception', id: 'FIRST', variant: 'V' });
  });

  it('2. leaves out the variant key when the diagnostic has none', () => {
    const wrong = mat([
      [9, 9],
      [9, 9],
    ]);
    const item = makeItem('matrix', correct, [{ id: 'M1', answer: wrong }]);
    const result = classify(item, wrong);
    expect(result).toEqual({ type: 'misconception', id: 'M1' });
    expect(Object.keys(result)).not.toContain('variant');
  });

  it('2. beats slip: a diagnostic one cell away still classifies as the diagnostic', () => {
    const near = mat([
      [1, 2],
      [3, 5],
    ]);
    const item = makeItem('matrix', correct, [{ id: 'M1', answer: near }]);
    expect(classify(item, near)).toEqual({ type: 'misconception', id: 'M1' });
  });

  it('3. exactly one wrong cell is a slip with a 1-based cell', () => {
    const item = makeItem('matrix', correct);
    expect(
      classify(
        item,
        mat([
          [1, 2],
          [3, 5],
        ]),
      ),
    ).toEqual({ type: 'slip', cell: [2, 2] });
    expect(
      classify(
        item,
        mat([
          [1, 7],
          [3, 4],
        ]),
      ),
    ).toEqual({ type: 'slip', cell: [1, 2] });
  });

  it('3. also applies to matrix_or_undefined', () => {
    const item = makeItem('matrix_or_undefined', correct);
    expect(
      classify(
        item,
        mat([
          [0, 2],
          [3, 4],
        ]),
      ),
    ).toEqual({ type: 'slip', cell: [1, 1] });
  });

  it('5. two wrong cells with no matching diagnostic is unknown', () => {
    const item = makeItem('matrix', correct);
    expect(
      classify(
        item,
        mat([
          [0, 0],
          [3, 4],
        ]),
      ),
    ).toEqual({ type: 'unknown' });
  });

  it('4. a different shape is a shape_error', () => {
    const item = makeItem('matrix', correct);
    expect(classify(item, mat([[1, 2, 3]]))).toEqual({ type: 'shape_error' });
    expect(classify(makeItem('matrix_or_undefined', correct), mat([[1], [2]]))).toEqual({
      type: 'shape_error',
    });
  });

  it('4. answering "undefined" when the matrix exists is a shape_error', () => {
    expect(classify(makeItem('matrix_or_undefined', correct), UNDEFINED)).toEqual({
      type: 'shape_error',
    });
  });

  it('"undefined" is correct when the matrix does not exist', () => {
    expect(classify(makeItem('matrix_or_undefined', UNDEFINED), UNDEFINED)).toEqual({
      type: 'correct',
    });
  });

  it('4. a matrix for an undefined item is a shape_error when no diagnostic catches it', () => {
    expect(classify(makeItem('matrix_or_undefined', UNDEFINED), correct)).toEqual({
      type: 'shape_error',
    });
  });
});

describe('ANY_MATRIX', () => {
  const item = makeItem('matrix_or_undefined', UNDEFINED, [{ id: 'M04', answer: ANY_MATRIX }]);

  it('matches any matrix of any shape', () => {
    for (const answer of [
      mat([[1]]),
      mat([
        [1, 2],
        [3, 4],
      ]),
      mat([[0, 0, 0]]),
    ]) {
      expect(classify(item, answer)).toEqual({ type: 'misconception', id: 'M04' });
    }
  });

  it('does not match "undefined"', () => {
    expect(classify(item, UNDEFINED)).toEqual({ type: 'correct' });
  });

  it('does not match non-matrix answers', () => {
    const scalarItem = makeItem('scalar', num(1), [{ id: 'M04', answer: ANY_MATRIX }]);
    expect(classify(scalarItem, num(2))).toEqual({ type: 'unknown' });
  });
});

describe('classify on non-matrix kinds', () => {
  it('scalar and cell answers never become slip or shape_error', () => {
    for (const kind of ['scalar', 'cell'] as const) {
      const item = makeItem(kind, num(5), [{ id: 'M1', answer: num(7) }]);
      expect(classify(item, num(7))).toEqual({ type: 'misconception', id: 'M1' });
      expect(classify(item, num(6))).toEqual({ type: 'unknown' });
    }
  });

  it('dims answers never become slip or shape_error', () => {
    const correct: Answer = { kind: 'dims', rows: 2, cols: 4 };
    const swapped: Answer = { kind: 'dims', rows: 4, cols: 2 };
    for (const kind of ['dims', 'dims_or_undefined'] as const) {
      const item = makeItem(kind, correct, [{ id: 'M8', variant: 'V', answer: swapped }]);
      expect(classify(item, correct)).toEqual({ type: 'correct' });
      expect(classify(item, swapped)).toEqual({ type: 'misconception', id: 'M8', variant: 'V' });
      expect(classify(item, { kind: 'dims', rows: 5, cols: 5 })).toEqual({ type: 'unknown' });
    }
  });

  it('dims_or_undefined can diagnose "undefined"', () => {
    const item = makeItem('dims_or_undefined', { kind: 'dims', rows: 2, cols: 4 }, [
      { id: 'M8', variant: 'SAME_DIMS', answer: UNDEFINED },
    ]);
    expect(classify(item, UNDEFINED)).toEqual({
      type: 'misconception',
      id: 'M8',
      variant: 'SAME_DIMS',
    });
  });

  it('choice answers match by id', () => {
    const item = makeItem('choice', { kind: 'choice', id: 'a' }, [
      { id: 'M1', answer: { kind: 'choice', id: 'b' } },
    ]);
    expect(classify(item, { kind: 'choice', id: 'a' })).toEqual({ type: 'correct' });
    expect(classify(item, { kind: 'choice', id: 'b' })).toEqual({
      type: 'misconception',
      id: 'M1',
    });
    expect(classify(item, { kind: 'choice', id: 'c' })).toEqual({ type: 'unknown' });
  });

  it('an answer of the wrong kind is unknown, not a crash', () => {
    expect(classify(makeItem('scalar', num(1)), mat([[1]]))).toEqual({ type: 'unknown' });
    expect(
      classify(
        makeItem(
          'matrix',
          mat([
            [1, 2],
            [3, 4],
          ]),
        ),
        num(1),
      ),
    ).toEqual({ type: 'unknown' });
  });
});

describe('answersEqual', () => {
  it('needs the same kind and value', () => {
    expect(answersEqual(num(1), num(1))).toBe(true);
    expect(answersEqual(num(1), num(2))).toBe(false);
    expect(answersEqual(num(1), mat([[1]]))).toBe(false);
    expect(answersEqual(UNDEFINED, UNDEFINED)).toBe(true);
    expect(
      answersEqual({ kind: 'dims', rows: 2, cols: 3 }, { kind: 'dims', rows: 3, cols: 2 }),
    ).toBe(false);
    expect(answersEqual(mat([[1, 2]]), mat([[1], [2]]))).toBe(false);
  });
});

describe('countDiffCells', () => {
  it('counts differing cells of same-shape matrices', () => {
    expect(
      countDiffCells(
        m([
          [1, 2],
          [3, 4],
        ]),
        m([
          [1, 0],
          [0, 4],
        ]),
      ),
    ).toBe(2);
  });

  it('returns null when the shapes differ', () => {
    expect(countDiffCells(m([[1, 2]]), m([[1], [2]]))).toBeNull();
  });
});
