import { describe, expect, it } from 'vitest';
import { Rational } from '@/lib/core/rational';
import type { Answer, Level } from '@/lib/core/types';
import { misconceptionAnswer, slipAnswer } from '@/lib/sim/answers';
import { assemble, generate } from '@/lib/topics/matrix/generators';
import { matrix } from '@/lib/topics/matrix/ops';
import { remediationScene } from '@/lib/topics/matrix/scenes';
import { SKILLS, levelsOf, type SkillId } from '@/lib/topics/matrix/skills';
import type { FormId } from '@/lib/topics/matrix/types';
import {
  allowedTokens,
  fillStudentText,
  REVEALING_TOKENS,
  resolveTokens,
  type TokenName,
} from './tokens';

const A = matrix([
  [2, 1],
  [3, 4],
]);
const B = matrix([
  [1, 5],
  [2, 0],
]);
// MISCONCEPTIONS §3 M09: AB = [[4,10],[11,15]], and the student answered [[2,5],[6,0]].
const MULT = assemble('mult', 1, { form: 'mult', A, B });
const ELEMENTWISE: Answer = {
  kind: 'matrix',
  value: matrix([
    [2, 5],
    [6, 0],
  ]),
};

describe('resolveTokens (AI_DIRECTOR §4.4)', () => {
  it('fills the example of §4.1 with the engine values', () => {
    expect(resolveTokens(MULT, ELEMENTWISE, { revealAllowed: true })).toEqual({
      i: '1',
      j: '1',
      aCell: '2',
      bCell: '1',
      studentCell: '2',
      correctCell: '4',
      dimsA: '2×2',
      dimsB: '2×2',
      studentAnswer: '[2, 5; 6, 0]',
      correctAnswer: '[4, 10; 11, 15]',
    });
  });

  it('holds back every revealing token until the item is closed', () => {
    for (const item of [MULT, generate({ skill: 'det2', difficulty: 1, seed: 2 })]) {
      const values = resolveTokens(item, undefined, { revealAllowed: false });
      for (const token of REVEALING_TOKENS) expect(values[token]).toBeUndefined();
    }
  });

  it('uses the same cell as the scene for the same answer', () => {
    const item = generate({ skill: 'mult', difficulty: 1, seed: 11, target: 'M10_MULT_ROW_ROW' });
    const answer = misconceptionAnswer(item, 'M10_MULT_ROW_ROW')!;
    const spec = remediationScene(item, answer, { id: 'M10_MULT_ROW_ROW', variant: 'ROW_ROW' });
    if (spec.template !== 'row_col_dot') throw new Error('wrong template');
    const values = resolveTokens(item, answer, { revealAllowed: true });
    expect([Number(values.i), Number(values.j)]).toEqual(spec.params.cell);
  });

  it('finds the cell of an index item from the item itself', () => {
    const item = assemble('index', 1, {
      form: 'index',
      A: matrix([
        [5, 8, 1],
        [2, 7, 4],
        [9, 3, 6],
      ]),
      i: 2,
      j: 3,
    });
    const values = resolveTokens(item, undefined, { revealAllowed: false });
    expect(values).toMatchObject({ i: '2', j: '3', dimsA: '3×3' });
    expect(values.bCell).toBeUndefined();
    expect(resolveTokens(item, undefined, { revealAllowed: true }).aCell).toBe('4');
  });

  it('gives k with a typographic minus', () => {
    const item = assemble('scalar', 2, {
      form: 'scalar',
      k: -3,
      A: matrix([
        [1, -2],
        [5, 4],
      ]),
    });
    expect(resolveTokens(item, undefined, { revealAllowed: false }).k).toBe('−3');
  });

  it('gives det only after closing, and only where it is the answer', () => {
    const item = assemble('det2', 1, { form: 'det2', A });
    expect(resolveTokens(item, undefined, { revealAllowed: true }).det).toBe('5');
    expect(resolveTokens(item, undefined, { revealAllowed: false }).det).toBeUndefined();
    expect(resolveTokens(MULT, undefined, { revealAllowed: true }).det).toBeUndefined();
  });

  it('writes a choice and "undefined" in words', () => {
    const item = generate({ skill: 'invertible', difficulty: 1, seed: 3 });
    const answer: Answer = { kind: 'choice', id: 'has_inverse' };
    expect(resolveTokens(item, answer, { revealAllowed: false }).studentAnswer).toBe('มี');
    const dims = generate({ skill: 'mult_defined', difficulty: 1, seed: 3 });
    const none: Answer = { kind: 'undefined' };
    expect(resolveTokens(dims, none, { revealAllowed: false }).studentAnswer).toBe('หาค่าไม่ได้');
  });

  it('writes fractions the way a student reads them', () => {
    const item = assemble('det2', 1, { form: 'det2', A });
    const answer: Answer = { kind: 'scalar', value: Rational.of(-3, 2) };
    expect(resolveTokens(item, answer, { revealAllowed: false }).studentAnswer).toBe('−3/2');
  });

  it('with no answer yet, points at where the target differs most', () => {
    const item = assemble('mult', 1, { form: 'mult', A, B }, { target: 'M09_MULT_ELEMENTWISE' });
    const values = resolveTokens(item, undefined, { revealAllowed: false });
    // AB − A∘B = [[2,5],[5,15]], widest at row 2 column 2.
    expect(values).toMatchObject({ i: '2', j: '2', aCell: '4', bCell: '0' });
  });
});

describe('a token that is the question on its form (AI_DIRECTOR §4.4)', () => {
  const OPEN = { revealAllowed: false };
  const CLOSED = { revealAllowed: true };
  const SEEDS = 100;
  const COMBOS = SKILLS.flatMap(({ id }) =>
    levelsOf(id).map((level): [SkillId, Level] => [id, level]),
  );

  /** Written out here and not read from the code, so a change to either one fails this test. */
  const ANSWER_ON_FORM: Partial<Record<FormId, TokenName>> = { dim: 'dimsA', index: 'aCell' };

  it.each(COMBOS)('%s L%i: waits for the item to close', (skill, difficulty) => {
    for (let seed = 0; seed < SEEDS; seed += 1) {
      const item = generate({ skill, difficulty, seed });
      const token = ANSWER_ON_FORM[item.data.form];
      if (!token) continue;
      const answer = slipAnswer(item);
      const open = resolveTokens(item, undefined, OPEN);
      expect(open[token]).toBeUndefined();
      expect(resolveTokens(item, answer, OPEN)[token]).toBeUndefined();
      expect(allowedTokens(item, undefined, OPEN)).not.toContain(token);
      expect(() => fillStudentText(`{{${token}}}`, item, undefined, OPEN)).toThrow(token);

      const closed = resolveTokens(item, answer, CLOSED);
      expect(closed[token]).toBe(closed.correctAnswer);
      expect(allowedTokens(item, answer, CLOSED)).toContain(token);
      expect(fillStudentText(`{{${token}}}`, item, answer, CLOSED)).toBe(closed.correctAnswer);
    }
  });

  it.each(COMBOS)('%s L%i: holds back nothing else', (skill, difficulty) => {
    for (let seed = 0; seed < SEEDS; seed += 1) {
      const item = generate({ skill, difficulty, seed });
      const open = allowedTokens(item, undefined, OPEN);
      const closed = allowedTokens(item, undefined, CLOSED);
      const heldBack = closed.filter((token) => !open.includes(token));
      const expected = [...REVEALING_TOKENS, ANSWER_ON_FORM[item.data.form]];
      expect(heldBack.filter((token) => !expected.includes(token))).toEqual([]);
    }
  });

  it('leaves no token that is the answer on every item while the item is open', () => {
    for (const [skill, difficulty] of COMBOS) {
      const matches = new Map<string, number>();
      for (let seed = 0; seed < SEEDS; seed += 1) {
        const item = generate({ skill, difficulty, seed });
        const { correctAnswer } = resolveTokens(item, undefined, CLOSED);
        const open = resolveTokens(item, undefined, OPEN);
        for (const [token, value] of Object.entries(open)) {
          const key = `${item.data.form}:${token}`;
          if (value === correctAnswer) matches.set(key, (matches.get(key) ?? 0) + 1);
        }
      }
      for (const [key, count] of matches) {
        expect(count, `${skill} L${difficulty} ${key}`).toBeLessThan(SEEDS);
      }
    }
  });

  it('keeps what the prompt states, even where it can match the answer by chance', () => {
    const index = generate({ skill: 'index', difficulty: 1, seed: 1 });
    expect(allowedTokens(index, undefined, OPEN)).toEqual(
      expect.arrayContaining(['i', 'j', 'dimsA']),
    );
    const dims = generate({ skill: 'mult_defined', difficulty: 1, seed: 1 });
    expect(allowedTokens(dims, undefined, OPEN)).toEqual(
      expect.arrayContaining(['dimsA', 'dimsB']),
    );
    const scaled = generate({ skill: 'det_props', difficulty: 1, seed: 1 });
    expect(allowedTokens(scaled, undefined, OPEN)).toContain('k');
  });

  it('leaves other forms as they were', () => {
    expect(resolveTokens(MULT, undefined, OPEN)).toMatchObject({ aCell: '4', dimsA: '2×2' });
  });
});

describe('allowedTokens', () => {
  it('lists what has a value here', () => {
    expect(allowedTokens(MULT, ELEMENTWISE, { revealAllowed: false })).toEqual([
      'i',
      'j',
      'aCell',
      'bCell',
      'studentCell',
      'dimsA',
      'dimsB',
      'studentAnswer',
    ]);
  });
});

describe('fillStudentText', () => {
  it('fills tokens from the engine', () => {
    const text = 'ช่องแถว {{i}} หลัก {{j}} ไม่ได้มาจาก {{aCell}} × {{bCell}} ตรงๆ';
    expect(fillStudentText(text, MULT, ELEMENTWISE, { revealAllowed: true })).toBe(
      'ช่องแถว 1 หลัก 1 ไม่ได้มาจาก 2 × 1 ตรงๆ',
    );
  });

  it('throws on a revealing token before the item is closed', () => {
    expect(() =>
      fillStudentText('{{correctAnswer}}', MULT, ELEMENTWISE, { revealAllowed: false }),
    ).toThrow(/correctAnswer/);
  });

  it('throws on a token this item has no value for', () => {
    expect(() => fillStudentText('{{k}}', MULT, ELEMENTWISE, { revealAllowed: true })).toThrow(/k/);
  });
});
