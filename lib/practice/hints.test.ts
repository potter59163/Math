import fc from 'fast-check';
import katex from 'katex';
import { describe, expect, it } from 'vitest';
import { th } from '@/lib/content/th';
import { fillTokens } from '@/lib/core/tokens';
import type { Level } from '@/lib/core/types';
import { assemble, generate } from '@/lib/topics/matrix/generators';
import { matrix } from '@/lib/topics/matrix/ops';
import { SKILLS, levelsOf, type SkillId } from '@/lib/topics/matrix/skills';
import { hintStep, workedSteps } from '@/lib/topics/matrix/worked';
import { hintAt } from './hints';

const COMBOS: [SkillId, Level][] = SKILLS.flatMap(({ id }) =>
  levelsOf(id).map((level): [SkillId, Level] => [id, level]),
);

const MULT = assemble('mult', 1, {
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

describe('hint L1', () => {
  it('reminds the principle for the form of the item', () => {
    expect(hintAt(MULT, 1, [])).toEqual({ level: 1, text: th.hintL1.mult });
  });

  it('exists for every form', () => {
    for (const [skill, difficulty] of COMBOS) {
      for (let seed = 0; seed < 50; seed += 1) {
        const item = generate({ skill, difficulty, seed });
        expect(hintAt(item, 1, []).text.length).toBeGreaterThan(0);
      }
    }
  });
});

describe('hint L2 (SPEC §9)', () => {
  it('uses the hint of an open misconception, if this item can show it', () => {
    const hint = hintAt(MULT, 2, ['M09_MULT_ELEMENTWISE']);
    expect(hint).toEqual({ level: 2, text: th.hints.M09_MULT_ELEMENTWISE });
  });

  it('prefers the item target when two are open', () => {
    const probe = generate({ skill: 'mult', difficulty: 1, seed: 3, target: 'M10_MULT_ROW_ROW' });
    const hint = hintAt(probe, 2, ['M09_MULT_ELEMENTWISE', 'M10_MULT_ROW_ROW']);
    expect(hint.text).toBe(th.hints.M10_MULT_ROW_ROW);
  });

  it('ignores a misconception this item cannot show', () => {
    // M05 is about subtracting; this item only adds.
    const add = generate({ skill: 'addsub', difficulty: 1, seed: 1 });
    expect(hintAt(add, 2, ['M05_SUB_REVERSED']).text).not.toBe(th.hints.M05_SUB_REVERSED);
  });

  it('otherwise points at the first step of the solution', () => {
    const step = workedSteps(MULT)[0];
    expect(hintAt(MULT, 2, []).text).toBe(fillTokens(th.worked[step.labelKey], step.params));
  });

  it('does not reveal the row count on a dim item', () => {
    const item = generate({ skill: 'dim', difficulty: 1, seed: 1 });
    expect(hintAt(item, 2, []).text).not.toMatch(/\d/);
  });

  it('says more than a bare cell label on an addition item', () => {
    const item = generate({ skill: 'addsub', difficulty: 1, seed: 1 });
    expect(hintAt(item, 2, []).text).not.toBe(
      fillTokens(th.worked.addsub_cell, { i: '1', j: '1' }),
    );
  });

  it('fills every token on every item', () => {
    for (const [skill, difficulty] of COMBOS) {
      for (let seed = 0; seed < 50; seed += 1) {
        const item = generate({ skill, difficulty, seed });
        expect(hintAt(item, 2, []).text).not.toMatch(/[{}]/);
      }
    }
  });
});

describe('hint L3 (SPEC §9)', () => {
  it('shows one cell of a matrix answer, using the documented form', () => {
    const hint = hintAt(MULT, 3, []);
    expect(hint.latex).toContain('2 \\cdot 1 + 1 \\cdot 2 = 4');
    expect(hint.text).toBe(fillTokens(th.worked.mult_cell, { i: '1', j: '1' }));
  });

  it.each(COMBOS)('%s L%i: never shows the finished answer', (skill, difficulty) => {
    fc.assert(
      fc.property(fc.nat(2 ** 31 - 1), (seed) => {
        const item = generate({ skill, difficulty, seed });
        const steps = workedSteps(item);
        const hint = hintStep(item);
        expect(hint.latex).not.toBe(steps[steps.length - 1].latex);
        // A one-step solution is the answer, so its hint carries no result.
        if (steps.length === 1) expect(hint.value).toBeUndefined();
      }),
    );
  });

  it.each<[string, SkillId, Level, RegExp]>([
    ['det2 stops before the result', 'det2', 1, /^\\det\(A\) = ad - bc = [^=]*$/],
    ['det2 stops before the result at L2', 'det2', 2, /^\\det\(A\) = ad - bc = [^=]*$/],
    ['index shows the row, not the cell', 'index', 1, /^\\begin\{bmatrix\}[^\\]*\\end\{bmatrix\}$/],
    ['index shows one row at L3', 'index', 3, /^\\begin\{bmatrix\}[^\\]*\\end\{bmatrix\}$/],
  ])('%s', (_, skill, difficulty, pattern) => {
    for (let seed = 0; seed < 200; seed += 1) {
      const item = generate({ skill, difficulty, seed });
      expect(hintStep(item).latex).toMatch(pattern);
    }
  });

  it('keeps det(AB), det(Aᵀ) and det(A⁻¹) to the rule, without the result', () => {
    const product = assemble('det_props', 2, { form: 'det_product', p: 2, q: 3 });
    expect(hintStep(product).latex).toBe('\\det(AB) = \\det(A)\\det(B) = 2 \\cdot 3');

    const transposed = assemble('det_props', 3, { form: 'det_transpose', d: 5 });
    expect(hintStep(transposed).latex).toBe('\\det(A^{T}) = \\det(A)');

    const inverse = assemble('det_props', 3, { form: 'det_inverse', d: 5 });
    expect(hintStep(inverse).latex).toBe('\\det(A^{-1}) = \\frac{1}{\\det(A)}');
  });

  it('renders in KaTeX with a filled caption on every item', () => {
    for (const [skill, difficulty] of COMBOS) {
      for (let seed = 0; seed < 50; seed += 1) {
        const item = generate({ skill, difficulty, seed });
        const hint = hintAt(item, 3, []);
        expect(hint.text).not.toMatch(/[{}]/);
        expect(() => katex.renderToString(hint.latex ?? '', { throwOnError: true })).not.toThrow();
      }
    }
  });
});
