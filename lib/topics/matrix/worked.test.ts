import katex from 'katex';
import { describe, expect, it } from 'vitest';
import { th } from '@/lib/content/th';
import { answersEqual } from '@/lib/core/classify';
import { fillTokens } from '@/lib/core/tokens';
import { assemble, generate } from './generators';
import { matrix } from './ops';
import { SKILLS, levelsOf } from './skills';
import { workedSteps } from './worked';

const SEEDS = Array.from({ length: 150 }, (_, i) => i * 7919);

const allItems = SKILLS.flatMap(({ id }) =>
  levelsOf(id).flatMap((difficulty) =>
    SEEDS.map((seed) => generate({ skill: id, difficulty, seed })),
  ),
);

describe('workedSteps on every skill × level', () => {
  it('ends on the correct answer', () => {
    for (const item of allItems) {
      const steps = workedSteps(item);
      expect(steps.length).toBeGreaterThan(0);
      const last = steps[steps.length - 1].value;
      expect(last).toBeDefined();
      expect(answersEqual(last!, item.correct)).toBe(true);
    }
  });

  it('produces LaTeX that KaTeX can render', () => {
    for (const item of allItems) {
      for (const step of workedSteps(item)) {
        expect(() => katex.renderToString(step.latex, { throwOnError: true })).not.toThrow();
      }
    }
  });

  it('has a Thai caption for every step, with every token filled', () => {
    for (const item of allItems) {
      for (const step of workedSteps(item)) {
        const caption = fillTokens(th.worked[step.labelKey], step.params);
        expect(caption).not.toMatch(/[{}]/);
        expect(caption.length).toBeGreaterThan(0);
      }
    }
  });

  it('keeps Thai out of the formulas', () => {
    for (const item of allItems) {
      for (const step of workedSteps(item)) {
        expect(step.latex).not.toMatch(/[฀-๿]/);
      }
    }
  });
});

describe('the documented step', () => {
  const item = assemble('mult', 1, {
    form: 'mult',
    A: matrix([
      [2, 1],
      [3, 4],
    ]),
    B: matrix([
      [1, 5],
      [2, 0],
    ]),
  });

  it('SCENES §3.5: c₁₁ = a₁₁b₁₁ + a₁₂b₂₁ = 2·1 + 1·2 = 4', () => {
    const [step] = workedSteps(item, { cell: [1, 1] });
    expect(step.latex).toBe('c_{11} = a_{11}b_{11} + a_{12}b_{21} = 2 \\cdot 1 + 1 \\cdot 2 = 4');
  });

  it('brackets negative factors', () => {
    const negative = assemble('mult', 2, {
      form: 'mult',
      A: matrix([
        [-2, 1],
        [3, 4],
      ]),
      B: matrix([
        [1, -5],
        [2, 0],
      ]),
    });
    expect(workedSteps(negative, { cell: [1, 2] })[0].latex).toContain('(-2) \\cdot (-5)');
  });
});

describe('focus, used by hint L3', () => {
  it('one cell of a matrix answer gives one step and never the finished answer', () => {
    for (const item of allItems) {
      if (item.correct.kind !== 'matrix') continue;
      const steps = workedSteps(item, { cell: [1, 1] });
      expect(steps.length).toBeGreaterThan(0);
      for (const step of steps) {
        const reveals = step.value !== undefined && answersEqual(step.value, item.correct);
        expect(reveals).toBe(false);
      }
    }
  });

  it('every cell of a matrix answer can be focused', () => {
    for (const item of allItems) {
      if (item.correct.kind !== 'matrix' || item.data.form === 'inv2') continue;
      item.correct.value.forEach((row, i) => {
        row.forEach((_, j) => {
          expect(workedSteps(item, { cell: [i + 1, j + 1] }).length).toBeGreaterThan(0);
        });
      });
    }
  });

  it('a step index gives only that step', () => {
    const item = generate({ skill: 'det3', difficulty: 1, seed: 1 });
    const all = workedSteps(item);
    expect(workedSteps(item, { step: 1 })).toEqual([all[1]]);
    expect(workedSteps(item, { step: 99 })).toEqual([]);
  });

  it('a cell focus outside the answer gives nothing', () => {
    const item = generate({ skill: 'mult', difficulty: 1, seed: 1 });
    expect(workedSteps(item, { cell: [9, 9] })).toEqual([]);
  });
});
