import { describe, expect, it } from 'vitest';
import { Rational } from './rational';
import {
  ANY_MATRIX,
  type Answer,
  type Diagnostic,
  type Item,
  type ItemKind,
  type ItemRef,
  type Matrix,
} from './types';
import { validateItem } from './validate';

const m = (rows: number[][]): Matrix => rows.map((row) => row.map((cell) => Rational.of(cell)));
const mat = (rows: number[][]): Answer => ({ kind: 'matrix', value: m(rows) });
const num = (value: number): Answer => ({ kind: 'scalar', value: Rational.of(value) });

function makeItem(
  kind: ItemKind,
  correct: Answer,
  diagnostics: Diagnostic[] = [],
  ref: Partial<ItemRef> = {},
): Item {
  return {
    ref: { topic: 'test', skill: 'test', difficulty: 1, seed: 0, gv: 1, ...ref },
    kind,
    prompt: { key: 'test' },
    data: null,
    correct,
    diagnostics,
  };
}

const CORRECT = mat([
  [1, 2],
  [3, 4],
]);
const FAR = mat([
  [9, 9],
  [9, 9],
]);
const OTHER_FAR = mat([
  [8, 8],
  [8, 8],
]);

describe('rule 1: diagnostics never equal the correct answer', () => {
  it('rejects a matrix diagnostic equal to the correct answer', () => {
    const item = makeItem('matrix', CORRECT, [{ id: 'M1', answer: CORRECT }]);
    expect(validateItem(item)).toMatchObject({ ok: false, failure: { rule: 1 } });
  });

  it('rejects a scalar diagnostic equal to the correct answer', () => {
    const item = makeItem('scalar', num(5), [{ id: 'M1', answer: num(5) }]);
    expect(validateItem(item)).toMatchObject({ ok: false, failure: { rule: 1 } });
  });

  it('rejects ANY_MATRIX when the correct answer is a matrix', () => {
    const item = makeItem('matrix_or_undefined', CORRECT, [{ id: 'M4', answer: ANY_MATRIX }]);
    expect(validateItem(item)).toMatchObject({ ok: false, failure: { rule: 1 } });
  });

  it('accepts ANY_MATRIX when the correct answer is "undefined"', () => {
    const item = makeItem('matrix_or_undefined', { kind: 'undefined' }, [
      { id: 'M4', answer: ANY_MATRIX },
    ]);
    expect(validateItem(item)).toEqual({ ok: true });
  });
});

describe('rule 2: diagnostics differ pairwise', () => {
  it('rejects two equal diagnostics', () => {
    const item = makeItem('matrix', CORRECT, [
      { id: 'M1', answer: FAR },
      { id: 'M2', answer: FAR },
    ]);
    expect(validateItem(item)).toMatchObject({ ok: false, failure: { rule: 2 } });
  });

  it('rejects ANY_MATRIX next to a concrete matrix diagnostic', () => {
    const item = makeItem('matrix_or_undefined', { kind: 'undefined' }, [
      { id: 'M4', answer: ANY_MATRIX },
      { id: 'M5', answer: FAR },
    ]);
    expect(validateItem(item)).toMatchObject({ ok: false, failure: { rule: 2 } });
  });

  it('accepts distinct diagnostics', () => {
    const item = makeItem('matrix', CORRECT, [
      { id: 'M1', answer: FAR },
      { id: 'M2', answer: OTHER_FAR },
    ]);
    expect(validateItem(item)).toEqual({ ok: true });
  });
});

describe('rule 3: same-shape diagnostics stay two cells from the answer', () => {
  it('rejects a diagnostic one cell away', () => {
    const item = makeItem('matrix', CORRECT, [
      {
        id: 'M1',
        answer: mat([
          [1, 2],
          [3, 5],
        ]),
      },
    ]);
    expect(validateItem(item)).toMatchObject({ ok: false, failure: { rule: 3 } });
  });

  it('accepts a diagnostic exactly two cells away', () => {
    const item = makeItem('matrix', CORRECT, [
      {
        id: 'M1',
        answer: mat([
          [1, 0],
          [0, 4],
        ]),
      },
    ]);
    expect(validateItem(item)).toEqual({ ok: true });
  });

  it('does not apply to a different shape', () => {
    const item = makeItem('matrix', CORRECT, [{ id: 'M1', answer: mat([[1, 2]]) }]);
    expect(validateItem(item)).toEqual({ ok: true });
  });

  it('does not apply to scalars', () => {
    const item = makeItem('scalar', num(5), [{ id: 'M1', answer: num(6) }]);
    expect(validateItem(item)).toEqual({ ok: true });
  });
});

describe('rule 4: the target must be separable', () => {
  it('rejects a target with no diagnostic', () => {
    const item = makeItem('matrix', CORRECT, [{ id: 'M1', answer: FAR }], { target: 'M2' });
    expect(validateItem(item)).toMatchObject({ ok: false, failure: { rule: 4 } });
  });

  it('accepts a target listed first', () => {
    const item = makeItem(
      'matrix',
      CORRECT,
      [
        { id: 'M2', answer: FAR },
        { id: 'M1', answer: OTHER_FAR },
      ],
      { target: 'M2' },
    );
    expect(validateItem(item)).toEqual({ ok: true });
  });

  it('rejects a target that is not listed first', () => {
    const item = makeItem(
      'matrix',
      CORRECT,
      [
        { id: 'M1', answer: OTHER_FAR },
        { id: 'M2', answer: FAR },
      ],
      { target: 'M2' },
    );
    expect(validateItem(item)).toMatchObject({ ok: false, failure: { rule: 4 } });
  });

  it('rejects a targeted variant with no diagnostic', () => {
    const item = makeItem('matrix', CORRECT, [{ id: 'M2', variant: 'A', answer: FAR }], {
      target: 'M2',
      targetVariant: 'B',
    });
    expect(validateItem(item)).toMatchObject({ ok: false, failure: { rule: 4 } });
  });

  it('accepts a targeted variant listed first', () => {
    const item = makeItem(
      'matrix',
      CORRECT,
      [
        { id: 'M2', variant: 'B', answer: FAR },
        { id: 'M2', variant: 'A', answer: OTHER_FAR },
      ],
      { target: 'M2', targetVariant: 'B' },
    );
    expect(validateItem(item)).toEqual({ ok: true });
  });

  it('a target that fails rules 1–3 fails validation', () => {
    const item = makeItem('matrix', CORRECT, [{ id: 'M2', answer: CORRECT }], { target: 'M2' });
    expect(validateItem(item)).toMatchObject({ ok: false, failure: { rule: 1 } });
  });
});

describe('topic rules', () => {
  it('reports a failure from the topic hook', () => {
    const item = makeItem('matrix', CORRECT);
    const result = validateItem(item, () => ({ rule: 5, detail: 'too big' }));
    expect(result).toEqual({ ok: false, failure: { rule: 5, detail: 'too big' } });
  });

  it('runs the topic hook only after rules 1–4 pass', () => {
    const item = makeItem('matrix', CORRECT, [{ id: 'M1', answer: CORRECT }]);
    let called = false;
    const result = validateItem(item, () => {
      called = true;
      return null;
    });
    expect(result).toMatchObject({ ok: false, failure: { rule: 1 } });
    expect(called).toBe(false);
  });

  it('passes when the hook finds nothing', () => {
    expect(validateItem(makeItem('matrix', CORRECT), () => null)).toEqual({ ok: true });
  });
});

describe('choice items', () => {
  const options = [
    { id: 'a', labelKey: 'a' },
    { id: 'b', labelKey: 'b' },
  ];

  it('accepts answers that are options', () => {
    const item: Item = {
      ...makeItem('choice', { kind: 'choice', id: 'a' }, [
        { id: 'M1', answer: { kind: 'choice', id: 'b' } },
      ]),
      options,
    };
    expect(validateItem(item)).toEqual({ ok: true });
  });

  it('rejects a correct answer or diagnostic that is not an option', () => {
    const bad: Item = {
      ...makeItem('choice', { kind: 'choice', id: 'x' }),
      options,
    };
    expect(validateItem(bad)).toMatchObject({ ok: false });
    const badDiagnostic: Item = {
      ...makeItem('choice', { kind: 'choice', id: 'a' }, [
        { id: 'M1', answer: { kind: 'choice', id: 'x' } },
      ]),
      options,
    };
    expect(validateItem(badDiagnostic)).toMatchObject({ ok: false });
  });
});
