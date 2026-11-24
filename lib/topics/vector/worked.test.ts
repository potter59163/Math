import katex from 'katex';
import { describe, expect, it } from 'vitest';
import { thVector } from '@/lib/content/th.vector';
import { answersEqual } from '@/lib/core/classify';
import { Rational } from '@/lib/core/rational';
import { fillTokens } from '@/lib/core/tokens';
import { assemble, generate } from './generators';
import { vec } from './ops';
import { SKILLS, levelsOf } from './skills';
import type { Figure, PointLabel, Term } from './types';
import { hintStep, workedSteps } from './worked';

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
        const caption = fillTokens(thVector.worked[step.labelKey], step.params);
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

  it('uses every caption; geom_same only when the answer is named another way (below)', () => {
    const used = new Set(allItems.flatMap((item) => workedSteps(item).map((s) => s.labelKey)));
    used.add('geom_same');
    expect([...used].sort()).toEqual(Object.keys(thVector.worked).sort());
  });
});

describe('the documented steps', () => {
  it('V09: |v|² = 1² + (−4)² + 1² = 18, |v| = √18 = 3√2', () => {
    const steps = workedSteps(assemble('v_magnitude', 2, { form: 'magnitude', v: vec(1, -4, 1) }));
    expect(steps.map((s) => s.latex)).toEqual([
      '|v|^2 = 1^2 + (-4)^2 + 1^2 = 18',
      '|v| = \\sqrt{18} = 3\\sqrt{2}',
    ]);
  });

  it('V20: the middle component is a₃b₁ − a₁b₃ = 3·1 − 2·(−2) = 7', () => {
    const item = assemble('v_cross', 2, {
      form: 'cross',
      u: vec(2, -1, 3),
      v: vec(1, 4, -2),
      order: 'uv',
    });
    const [middle] = workedSteps(item, { cell: [2, 1] });
    expect(middle.latex).toBe('c_2 = a_3b_1 - a_1b_3 = 3 \\cdot 1 - 2 \\cdot (-2) = 7');
    expect(middle.labelKey).toBe('cross_j');
  });

  it('V14: u·v = 3·4 + (−2)·5 = 2', () => {
    const [step] = workedSteps(assemble('v_dot', 1, { form: 'dot', u: vec(3, -2), v: vec(4, 5) }));
    expect(step.latex).toBe('u \\cdot v = 3 \\cdot 4 + (-2) \\cdot 5 = 2');
  });

  it('V25: u·(v × w) = −13, so the volume is 13', () => {
    const steps = workedSteps(
      assemble('v_volume', 2, {
        form: 'volume',
        u: vec(1, 2, 0),
        v: vec(2, 0, 1),
        w: vec(0, 1, 3),
      }),
    );
    expect(steps.map((s) => s.latex)).toEqual([
      'v \\times w = \\left(-1, -6, 2\\right)',
      'u \\cdot (v \\times w) = 1 \\cdot (-1) + 2 \\cdot (-6) + 0 \\cdot 2 = -13',
      '|u \\cdot (v \\times w)| = |-13| = 13',
    ]);
  });

  it('V03: AB − AD is AB + DA, which head to tail is DB', () => {
    const one = (from: PointLabel, to: PointLabel): Term => ({ k: Rational.ONE, from, to });
    const figure: Figure = {
      shape: 'parallelogram',
      outline: ['A', 'B', 'C', 'D'],
      points: [
        { label: 'A', at: [0, 0] },
        { label: 'B', at: [4, 0] },
        { label: 'C', at: [5, 3] },
        { label: 'D', at: [1, 3] },
      ],
      midpoints: [],
    };
    const item = assemble('v_geom', 2, {
      form: 'figure_expr',
      figure,
      expr: [one('A', 'B'), { k: Rational.of(-1), from: 'A', to: 'D' }],
      options: [one('D', 'B'), one('B', 'D'), one('A', 'C'), one('B', 'C')],
    });
    expect(workedSteps(item).map((s) => s.latex)).toEqual([
      '-\\overrightarrow{AD} = \\overrightarrow{DA}',
      '\\overrightarrow{DA} + \\overrightarrow{AB} = \\overrightarrow{DB}',
    ]);
  });
});

describe('a figure answer named differently from where the chain ends', () => {
  it('BM − BC ends at CM, and the option ½BC names the same vector', () => {
    const one = (from: PointLabel, to: PointLabel): Term => ({ k: Rational.ONE, from, to });
    const figure: Figure = {
      shape: 'parallelogram',
      outline: ['A', 'B', 'C', 'D'],
      points: [
        { label: 'A', at: [0, 0] },
        { label: 'B', at: [4, 0] },
        { label: 'C', at: [6, 4] },
        { label: 'D', at: [2, 4] },
        { label: 'M', at: [5, 2] },
      ],
      midpoints: [{ label: 'M', of: ['B', 'C'] }],
    };
    const item = assemble('v_geom', 3, {
      form: 'figure_expr',
      figure,
      expr: [one('B', 'M'), { k: Rational.of(-1), from: 'B', to: 'C' }],
      options: [
        { k: Rational.of(1, 2), from: 'C', to: 'B' },
        one('B', 'M'),
        one('A', 'C'),
        one('D', 'B'),
      ],
    });
    expect(item.correct).toEqual({ kind: 'choice', id: '1/2CB' });
    const steps = workedSteps(item);
    expect(steps.map((s) => s.labelKey)).toEqual(['geom_reverse', 'geom_chain', 'geom_same']);
    expect(steps[2].latex).toBe('\\overrightarrow{CM} = \\frac{1}{2}\\overrightarrow{CB}');
    expect(steps[2].value).toEqual(item.correct);
  });
});

describe('focus, used by hint L3', () => {
  it('one component of a vector answer gives a step that is never the finished answer', () => {
    for (const item of allItems) {
      if (item.correct.kind !== 'vector') continue;
      const steps = workedSteps(item, { cell: [1, 1] });
      expect(steps.length).toBeGreaterThan(0);
      for (const step of steps) {
        const reveals = step.value !== undefined && answersEqual(step.value, item.correct);
        expect(reveals).toBe(false);
      }
    }
  });

  it('every component of a vector answer can be focused', () => {
    for (const item of allItems) {
      if (item.correct.kind !== 'vector') continue;
      item.correct.value.forEach((_, i) => {
        expect(workedSteps(item, { cell: [i + 1, 1] }).length).toBeGreaterThan(0);
      });
    }
  });

  it('a step index gives only that step', () => {
    const item = generate({ skill: 'v_cross', difficulty: 1, seed: 1 });
    const all = workedSteps(item);
    expect(workedSteps(item, { step: 1 })).toEqual([all[1]]);
    expect(workedSteps(item, { step: 99 })).toEqual([]);
  });

  it('hintStep never shows the finished answer', () => {
    for (const item of allItems) {
      const step = hintStep(item);
      const reveals = step.value !== undefined && answersEqual(step.value, item.correct);
      expect(reveals).toBe(false);
      expect(() => katex.renderToString(step.latex, { throwOnError: true })).not.toThrow();
    }
  });
});
