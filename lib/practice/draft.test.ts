import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { classify } from '@/lib/core/classify';
import type { Answer, Item, Level } from '@/lib/core/types';
import { generate } from '@/lib/topics/matrix/generators';
import { SKILLS, levelsOf, type SkillId } from '@/lib/topics/matrix/skills';
import {
  draftFromAnswer,
  emptyDraft,
  focusBox,
  moveActive,
  pickChoice,
  pressKey,
  readiness,
  toggleUndefined,
  type Draft,
  type DraftItem,
  type KeypadKey,
} from './draft';

const MATRIX_2X3: DraftItem = { kind: 'matrix', grid: { rows: 2, cols: 3 } };
const SCALAR: DraftItem = { kind: 'scalar' };
const DIMS: DraftItem = { kind: 'dims_or_undefined' };
const MAYBE: DraftItem = { kind: 'matrix_or_undefined', grid: { rows: 1, cols: 2 } };

function type(draft: Draft, item: DraftItem, keys: string): Draft {
  return [...keys].reduce((current, key) => pressKey(current, item, key as KeypadKey), draft);
}

const typed = (item: DraftItem, keys: string) => type(emptyDraft(item), item, keys).cells[0];

/** Enters an answer through the same key presses a student would make. */
function enter(item: Item, answer: Answer): Draft {
  const draft = emptyDraft(item);
  if (answer.kind === 'undefined') return toggleUndefined(draft);
  if (answer.kind === 'choice') return pickChoice(draft, answer.id);
  const boxes =
    answer.kind === 'matrix'
      ? answer.value.flat().map(String)
      : answer.kind === 'scalar'
        ? [answer.value.toString()]
        : [String(answer.rows), String(answer.cols)];
  return boxes.reduce((current, text) => pressKey(type(current, item, text), item, 'next'), draft);
}

describe('emptyDraft', () => {
  it('has one box per thing to type', () => {
    expect(emptyDraft(MATRIX_2X3).cells).toHaveLength(6);
    expect(emptyDraft(SCALAR).cells).toHaveLength(1);
    expect(emptyDraft({ kind: 'cell' }).cells).toHaveLength(1);
    expect(emptyDraft(DIMS).cells).toHaveLength(2);
    expect(emptyDraft({ kind: 'choice' }).cells).toHaveLength(0);
  });

  it('throws when a matrix item has no grid', () => {
    expect(() => emptyDraft({ kind: 'matrix' })).toThrow();
  });
});

describe('pressKey on number boxes', () => {
  it('types integers, fractions and decimals', () => {
    expect(typed(SCALAR, '12')).toBe('12');
    expect(typed(SCALAR, '3/2')).toBe('3/2');
    expect(typed(SCALAR, '1.25')).toBe('1.25');
  });

  it('− flips the sign of the whole number from any position', () => {
    expect(typed(SCALAR, '-')).toBe('-');
    expect(typed(SCALAR, '-3')).toBe('-3');
    expect(typed(SCALAR, '3-')).toBe('-3');
    expect(typed(SCALAR, '3/2-')).toBe('-3/2');
    expect(typed(SCALAR, '-3-')).toBe('3');
    expect(typed(SCALAR, '--')).toBe('');
  });

  it('/ needs a digit before it and appears once', () => {
    expect(typed(SCALAR, '/')).toBe('');
    expect(typed(SCALAR, '-/')).toBe('-');
    expect(typed(SCALAR, '3//')).toBe('3/');
    expect(typed(SCALAR, '1.5/')).toBe('1.5');
  });

  it('. starts as 0. and never mixes with a fraction', () => {
    expect(typed(SCALAR, '.5')).toBe('0.5');
    expect(typed(SCALAR, '-.5')).toBe('-0.5');
    expect(typed(SCALAR, '1.2.')).toBe('1.2');
    expect(typed(SCALAR, '1/2.')).toBe('1/2');
  });

  it('stops at 8 characters, the most a box can show', () => {
    expect(typed(SCALAR, '1234567890')).toBe('12345678');
    expect(typed(SCALAR, '12345678-')).toBe('12345678');
    expect(typed(SCALAR, '-12345678')).toBe('-1234567');
  });

  it('ignores number keys on a choice item', () => {
    const item: DraftItem = { kind: 'choice' };
    const draft = emptyDraft(item);
    expect(pressKey(draft, item, '3')).toBe(draft);
    expect(pressKey(draft, item, 'next')).toBe(draft);
    expect(pressKey(draft, item, 'backspace')).toBe(draft);
  });
});

describe('pressKey on dims boxes', () => {
  it('takes digits only, at most two', () => {
    expect(typed(DIMS, '2-/.')).toBe('2');
    expect(typed(DIMS, '123')).toBe('12');
  });
});

describe('moving between boxes', () => {
  it('→ goes to the next box and wraps around', () => {
    let draft = emptyDraft(MATRIX_2X3);
    for (const expected of [1, 2, 3, 4, 5, 0]) {
      draft = pressKey(draft, MATRIX_2X3, 'next');
      expect(draft.active).toBe(expected);
    }
  });

  it('⌫ deletes, then steps back once the box is empty', () => {
    let draft = type(emptyDraft(MATRIX_2X3), MATRIX_2X3, '12');
    draft = pressKey(draft, MATRIX_2X3, 'next');
    draft = pressKey(draft, MATRIX_2X3, 'backspace');
    expect(draft.active).toBe(0);
    expect(draft.cells[0]).toBe('12');
    draft = pressKey(draft, MATRIX_2X3, 'backspace');
    expect(draft.cells[0]).toBe('1');
  });

  it('⌫ on an empty first box does nothing', () => {
    const draft = emptyDraft(MATRIX_2X3);
    expect(pressKey(draft, MATRIX_2X3, 'backspace')).toBe(draft);
  });

  it('tapping a box selects it', () => {
    expect(focusBox(emptyDraft(MATRIX_2X3), 4).active).toBe(4);
  });

  it('arrow keys move within the grid and stop at its edges', () => {
    const start = focusBox(emptyDraft(MATRIX_2X3), 1);
    expect(moveActive(start, MATRIX_2X3, 'right').active).toBe(2);
    expect(moveActive(start, MATRIX_2X3, 'left').active).toBe(0);
    expect(moveActive(start, MATRIX_2X3, 'down').active).toBe(4);
    expect(moveActive(start, MATRIX_2X3, 'up').active).toBe(1);
    expect(moveActive(focusBox(start, 2), MATRIX_2X3, 'right').active).toBe(2);
    expect(moveActive(focusBox(start, 3), MATRIX_2X3, 'left').active).toBe(3);
    expect(moveActive(focusBox(start, 4), MATRIX_2X3, 'down').active).toBe(4);
  });

  it('dims boxes sit side by side', () => {
    const start = emptyDraft(DIMS);
    expect(moveActive(start, DIMS, 'right').active).toBe(1);
    expect(moveActive(start, DIMS, 'down').active).toBe(0);
  });
});

describe('the undefined button', () => {
  it('toggles, and typing turns it off', () => {
    const on = toggleUndefined(emptyDraft(MAYBE));
    expect(on.isUndefined).toBe(true);
    expect(toggleUndefined(on).isUndefined).toBe(false);
    expect(pressKey(on, MAYBE, '3').isUndefined).toBe(false);
  });

  it('keeps what was typed, so turning it off brings the numbers back', () => {
    const draft = type(emptyDraft(MAYBE), MAYBE, '3');
    expect(toggleUndefined(toggleUndefined(draft)).cells[0]).toBe('3');
  });
});

describe('readiness', () => {
  it('points at the first empty box', () => {
    const draft = type(emptyDraft(MATRIX_2X3), MATRIX_2X3, '1');
    expect(readiness(MATRIX_2X3, draft)).toEqual({ ready: false, reason: 'incomplete', box: 1 });
  });

  it('points at a box that cannot be read yet', () => {
    const half = type(emptyDraft(SCALAR), SCALAR, '3/');
    expect(readiness(SCALAR, half)).toEqual({ ready: false, reason: 'invalid', box: 0 });
    const sign = type(emptyDraft(SCALAR), SCALAR, '-');
    expect(readiness(SCALAR, sign)).toEqual({ ready: false, reason: 'invalid', box: 0 });
  });

  it('refuses a zero denominator', () => {
    const draft = type(emptyDraft(SCALAR), SCALAR, '3/0');
    expect(readiness(SCALAR, draft)).toEqual({
      ready: false,
      reason: 'zero_denominator',
      box: 0,
    });
  });

  it('points at the failing dims box', () => {
    const empty = emptyDraft(DIMS);
    expect(readiness(DIMS, empty)).toEqual({ ready: false, reason: 'incomplete', box: 0 });
    const rowsOnly = type(empty, DIMS, '2');
    expect(readiness(DIMS, rowsOnly)).toEqual({ ready: false, reason: 'incomplete', box: 1 });
    const zero = pressKey(pressKey(rowsOnly, DIMS, 'next'), DIMS, '0');
    expect(readiness(DIMS, zero)).toEqual({ ready: false, reason: 'invalid', box: 1 });
  });

  it('accepts the undefined button with every box empty', () => {
    expect(readiness(MAYBE, toggleUndefined(emptyDraft(MAYBE)))).toEqual({
      ready: true,
      answer: { kind: 'undefined' },
    });
  });

  it('needs a choice on a choice item', () => {
    const item: DraftItem = { kind: 'choice' };
    expect(readiness(item, emptyDraft(item))).toEqual({
      ready: false,
      reason: 'incomplete',
      box: null,
    });
    expect(readiness(item, pickChoice(emptyDraft(item), 'true'))).toEqual({
      ready: true,
      answer: { kind: 'choice', id: 'true' },
    });
  });

  it('builds the matrix row by row', () => {
    const item: DraftItem = { kind: 'matrix', grid: { rows: 2, cols: 2 } };
    let draft = emptyDraft(item);
    for (const text of ['1', '2', '3', '4']) {
      draft = pressKey(type(draft, item, text), item, 'next');
    }
    const result = readiness(item, draft);
    expect(result.ready).toBe(true);
    if (result.ready && result.answer.kind === 'matrix') {
      expect(result.answer.value.map((row) => row.map(String))).toEqual([
        ['1', '2'],
        ['3', '4'],
      ]);
    }
  });
});

describe('every answer can be typed', () => {
  const combos: [SkillId, Level][] = SKILLS.flatMap(({ id }) =>
    levelsOf(id).map((level): [SkillId, Level] => [id, level]),
  );

  it.each(combos)('%s L%i: the keypad can enter the correct answer', (skill, difficulty) => {
    fc.assert(
      fc.property(fc.nat(2 ** 31 - 1), (seed) => {
        const item = generate({ skill, difficulty, seed });
        const result = readiness(item, enter(item, item.correct));
        expect(result.ready).toBe(true);
        if (result.ready) expect(classify(item, result.answer)).toEqual({ type: 'correct' });
      }),
    );
  });
});

describe('any key sequence', () => {
  const KEYS: KeypadKey[] = ['0', '1', '5', '9', '-', '/', '.', 'backspace', 'next'];

  it.each<[string, DraftItem]>([
    ['matrix', MATRIX_2X3],
    ['scalar', SCALAR],
    ['dims', DIMS],
  ])('keeps a %s draft within its limits and never throws', (_, item) => {
    fc.assert(
      fc.property(fc.array(fc.constantFrom(...KEYS), { maxLength: 40 }), (keys) => {
        const draft = keys.reduce((current, key) => pressKey(current, item, key), emptyDraft(item));
        expect(draft.active).toBeGreaterThanOrEqual(0);
        expect(draft.active).toBeLessThan(draft.cells.length);
        for (const cell of draft.cells) expect(cell.length).toBeLessThanOrEqual(8);
        expect(() => readiness(item, draft)).not.toThrow();
      }),
    );
  });
});

describe('draftFromAnswer', () => {
  it.each(SKILLS.flatMap(({ id }) => levelsOf(id).map((level): [SkillId, Level] => [id, level])))(
    '%s L%i: gives back an answer equal to the one sent',
    (skill, difficulty) => {
      for (let seed = 0; seed < 20; seed += 1) {
        const item = generate({ skill, difficulty, seed });
        const state = readiness(item, draftFromAnswer(item, item.correct));
        expect(state.ready).toBe(true);
        if (state.ready) expect(classify(item, state.answer)).toEqual({ type: 'correct' });
      }
    },
  );
});
