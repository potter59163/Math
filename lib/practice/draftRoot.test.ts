import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { parseSurd } from '@/lib/core/parse';
import { Rational } from '@/lib/core/rational';
import { SURD_MAX_RADICAND, Surd, surdText } from '@/lib/core/surd';
import {
  boxText,
  draftFromAnswer,
  emptyDraft,
  pressKey,
  readiness,
  type DraftItem,
  type KeypadKey,
} from './draft';

// Typing √ answers on the keypad (docs/VECTORS.md §3.3).

const SURD: DraftItem = { kind: 'surd' };
const VECTOR: DraftItem = { kind: 'vector', grid: { rows: 3, cols: 1 } };
const SCALAR: DraftItem = { kind: 'scalar' };

function typeKeys(item: DraftItem, keys: KeypadKey[]) {
  return keys.reduce((draft, key) => pressKey(draft, item, key), emptyDraft(item));
}

const chars = (text: string) => [...text] as KeypadKey[];

describe('typing √', () => {
  it.each([
    ['3√2', '3√2'],
    ['-√3/2', '-√3/2'],
    ['3/2√2', '3/2√2'],
    ['1/√2', '1/√2'],
    ['3√√2', '3√2'],
    ['3.√2', '3.2'],
    ['√2.5', '√25'],
    ['3√2/2/', '3√2/2'],
  ])('keys %s give %s', (keys, text) => {
    expect(typeKeys(SURD, chars(keys)).cells[0]).toBe(text);
  });

  it('ignores √ on items that cannot take it', () => {
    expect(typeKeys(SCALAR, chars('3√2')).cells[0]).toBe('32');
  });

  it('is ready once the text reads as a surd', () => {
    const ready = readiness(SURD, typeKeys(SURD, chars('3√2/2')));
    expect(ready.ready && ready.answer).toEqual({
      kind: 'surd',
      value: Surd.parse('3/2√2'),
    });
    const notYet = readiness(SURD, typeKeys(SURD, chars('3√')));
    expect(notYet).toEqual({ ready: false, reason: 'invalid', box: 0 });
  });
});

describe('vector drafts', () => {
  it('has one box per component and moves between them', () => {
    const draft = typeKeys(VECTOR, [...chars('1'), 'next', ...chars('√2'), 'next', '0']);
    expect(draft.cells).toEqual(['1', '√2', '0']);
    const ready = readiness(VECTOR, draft);
    expect(ready.ready && ready.answer).toEqual({
      kind: 'vector',
      value: [Surd.rational(1), Surd.sqrt(2), Surd.ZERO],
    });
  });

  it('points at the empty or broken component', () => {
    expect(readiness(VECTOR, typeKeys(VECTOR, ['1', 'next', 'next', '2']))).toEqual({
      ready: false,
      reason: 'incomplete',
      box: 1,
    });
  });

  it('shows a sent answer again after a reload', () => {
    const answer = { kind: 'vector' as const, value: [Surd.parse('-1/6√6'), Surd.ZERO, Surd.ONE] };
    const draft = draftFromAnswer(VECTOR, answer);
    const ready = readiness(VECTOR, draft);
    expect(ready.ready && ready.answer).toEqual(answer);
  });
});

describe('a closed √ item after a reload', () => {
  it('shows the form a student writes, √6/6, and not the stored 1/6√6', () => {
    const one = draftFromAnswer(SURD, { kind: 'surd', value: Surd.parse('1/6√6') });
    expect(one.cells).toEqual(['√6/6']);
    expect(draftFromAnswer(SURD, { kind: 'surd', value: Surd.parse('-3/2√2') }).cells).toEqual([
      '-3√2/2',
    ]);
    const parts = [Surd.parse('-1/6√6'), Surd.parse('-3/2'), Surd.parse('2√5')];
    const column = draftFromAnswer(VECTOR, { kind: 'vector', value: parts });
    expect(column.cells).toEqual(['-√6/6', '-3/2', '2√5']);
    expect(column.cells.map(boxText)).toEqual(['−√6/6', '−3/2', '2√5']);
  });

  // Every Surd there is: coefficient parts up to Rational's 1e9, any squarefree radicand Surd keeps.
  const coeff = fc
    .tuple(fc.integer({ min: -1e9, max: 1e9 }), fc.integer({ min: 1, max: 1e9 }))
    .map(([n, d]) => Rational.of(n, d));
  const radicand = fc
    .integer({ min: 1, max: SURD_MAX_RADICAND })
    .map((n) => Surd.of(1, n).radicand);
  const surd = fc.tuple(coeff, radicand).map(([c, r]) => Surd.of(c, r));

  /** The box reads back as the same value, and shows exactly what surdText prints for students. */
  const expectReadsBack = (box: string, value: Surd) => {
    const read = parseSurd(box);
    expect(read.ok && read.value.equals(value), `${box} for ${value.toString()}`).toBe(true);
    expect(boxText(box)).toBe(surdText(value));
  };

  it('fills a surd box with text parseSurd reads back to the same value', () => {
    fc.assert(
      fc.property(surd, (value) => {
        const answer = { kind: 'surd' as const, value };
        const draft = draftFromAnswer(SURD, answer);
        expect(draft.cells).toHaveLength(1);
        expectReadsBack(draft.cells[0], value);
        const ready = readiness(SURD, draft);
        expect(ready.ready && ready.answer).toEqual(answer);
      }),
      { numRuns: 1000 },
    );
  });

  it('fills every component box of a vector with text parseSurd reads back to the same value', () => {
    fc.assert(
      fc.property(fc.array(surd, { minLength: 2, maxLength: 3 }), (value) => {
        const item: DraftItem = { kind: 'vector', grid: { rows: value.length, cols: 1 } };
        const answer = { kind: 'vector' as const, value };
        const draft = draftFromAnswer(item, answer);
        expect(draft.cells).toHaveLength(value.length);
        draft.cells.forEach((box, i) => expectReadsBack(box, value[i]));
        const ready = readiness(item, draft);
        expect(ready.ready && ready.answer).toEqual(answer);
      }),
      { numRuns: 1000 },
    );
  });
});

describe('√ from a physical keyboard', () => {
  it('reads R, on any layout, as √', async () => {
    const { actionFromKey } = await import('./keyboard');
    expect(actionFromKey('KeyR', 'r')).toBe('√');
    expect(actionFromKey('KeyR', 'พ')).toBe('√');
    expect(actionFromKey('', '√')).toBe('√');
  });
});
