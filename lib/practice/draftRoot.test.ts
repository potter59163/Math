import { describe, expect, it } from 'vitest';
import { Surd } from '@/lib/core/surd';
import {
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
