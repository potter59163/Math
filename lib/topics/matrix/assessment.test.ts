import { describe, expect, it } from 'vitest';

import { validateMatrixItem } from './rules';
import {
  assessmentForm,
  BLUEPRINT,
  formFor,
  markAssessment,
  pretestResults,
  scoreOf,
} from './assessment';
import { regenerate } from './generators';
import type { Answer } from '@/lib/core/types';
import type { MisconceptionId } from './types';

describe('forms A and B (RESEARCH §4)', () => {
  const forms = [assessmentForm('A'), assessmentForm('B')];

  it("have 14 items in the blueprint's order", () => {
    for (const form of forms) {
      expect(form).toHaveLength(14);
      expect(form.map(({ ref }) => ref.skill)).toEqual(BLUEPRINT.map(({ skill }) => skill));
    }
  });

  it('meet every row of the blueprint', () => {
    for (const form of forms) {
      form.forEach((item, index) =>
        expect(BLUEPRINT[index].fits(item), `row ${index + 1}`).toBe(true),
      );
    }
  });

  it('pass validateItem', () => {
    for (const form of forms) {
      for (const item of form) {
        expect(validateMatrixItem(item).ok, JSON.stringify(item.ref)).toBe(true);
      }
    }
  });

  it('have different numbers from each other, apart from the items whose spec fixes them', () => {
    const [a, b] = forms;
    a.forEach((item, index) => {
      // Row 7 is always two 2×3s, and row 9 always the same statement.
      if (index !== 6 && item.data.form !== 'noncomm_statement') {
        expect(JSON.stringify(item.data), `row ${index + 1}`).not.toBe(
          JSON.stringify(b[index].data),
        );
      }
    });
  });

  it('are rebuilt exactly from their references, as the browser and the marking server both do', () => {
    for (const form of forms) {
      for (const item of form) {
        expect(JSON.stringify(regenerate(item.ref).data)).toBe(JSON.stringify(item.data));
      }
    }
  });

  it('are the same every time', () => {
    expect(assessmentForm('A')).toBe(forms[0]);
  });
});

describe('formFor', () => {
  it('gives each student a different form afterwards', () => {
    for (let n = 0; n < 50; n += 1) {
      expect(formFor(`u${n}`, 'pre')).not.toBe(formFor(`u${n}`, 'post'));
    }
  });
  it('splits students across both', () => {
    const pres = new Set(Array.from({ length: 50 }, (_, n) => formFor(`u${n}`, 'pre')));
    expect(pres.size).toBe(2);
  });
});

function answersFor(pick: (itemNo: number, correct: Answer) => Answer | null) {
  return new Map(
    assessmentForm('A').map((item, index) => [index + 1, pick(index + 1, item.correct)]),
  );
}

describe('marking', () => {
  it('counts right answers', () => {
    expect(
      scoreOf(
        markAssessment(
          'A',
          answersFor((_n, correct) => correct),
        ),
      ),
    ).toEqual({
      score: 14,
      total: 14,
    });
  });

  it('counts an item skipped as not right, and nothing else about it', () => {
    const marked = markAssessment('A', new Map());
    expect(scoreOf(marked).score).toBe(0);
    expect(marked.every(({ classification }) => classification === null)).toBe(true);
  });

  it('reads a skill as right only if all its items were', () => {
    const results = pretestResults(
      markAssessment(
        'A',
        answersFor((n, correct) => (n === 7 ? null : correct)),
      ),
    );
    expect(results.dim).toEqual({ outcome: 'correct' });
    expect(results.mult_defined).toEqual({ outcome: 'other_wrong' });
  });

  it('names a misconception the test caught', () => {
    const form = assessmentForm('A');
    const mult = form[7];
    const m09 = mult.diagnostics.find(({ id }) => id === 'M09_MULT_ELEMENTWISE');
    if (!m09 || m09.answer.kind !== 'matrix') throw new Error('no M09 on item 8');
    const elementwise: Answer = { kind: 'matrix', value: m09.answer.value };
    const results = pretestResults(markAssessment('A', new Map([[8, elementwise]])));
    expect(results.mult?.outcome).toBe('misconception');
    expect(results.mult?.caught?.[0].id).toBe('M09_MULT_ELEMENTWISE' satisfies MisconceptionId);
  });
});
