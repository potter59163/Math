import { describe, expect, it } from 'vitest';
import type { Answer } from '@/lib/core/types';
import {
  assessmentForm,
  BLUEPRINT,
  formFor,
  markAssessment,
  pretestResults,
  scoreOf,
} from './assessment';
import { regenerate } from './generators';
import { validateVectorItem } from './rules';
import type { MisconceptionId } from './types';

describe('vector forms A and B', () => {
  const forms = [assessmentForm('A'), assessmentForm('B')];

  it("have 14 items in the blueprint's order, covering every skill", () => {
    for (const form of forms) {
      expect(form).toHaveLength(14);
      expect(form.map(({ ref }) => ref.skill)).toEqual(BLUEPRINT.map(({ skill }) => skill));
      expect(new Set(form.map(({ ref }) => ref.skill)).size).toBe(13);
    }
  });

  it('meet every row of the blueprint, with its target listed first', () => {
    for (const form of forms) {
      form.forEach((item, index) => {
        expect(BLUEPRINT[index].fits(item), `row ${index + 1}`).toBe(true);
        expect(item.diagnostics[0]?.id).toBe(BLUEPRINT[index].target);
      });
    }
  });

  it('pass validateItem', () => {
    for (const form of forms) {
      for (const item of form) {
        expect(validateVectorItem(item).ok, JSON.stringify(item.ref)).toBe(true);
      }
    }
  });

  it('have different items from each other', () => {
    const [a, b] = forms;
    a.forEach((item, index) => {
      expect(JSON.stringify(item.data), `row ${index + 1}`).not.toBe(JSON.stringify(b[index].data));
    });
  });

  it('are rebuilt exactly from their references, as the browser and the marking server both do', () => {
    for (const form of forms) {
      for (const item of form) {
        expect(regenerate(item.ref)).toEqual(item);
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
        answersFor((n, correct) => (n === 3 ? null : correct)),
      ),
    );
    expect(results.v_quantity).toEqual({ outcome: 'correct' });
    expect(results.v_geom).toEqual({ outcome: 'other_wrong' });
  });

  it('names a misconception the test caught', () => {
    const cross = assessmentForm('A')[11];
    const v20 = cross.diagnostics.find(({ id }) => id === 'V20_CROSS_MIDDLE_SIGN');
    if (!v20 || v20.answer.kind !== 'vector') throw new Error('no V20 on item 12');
    const results = pretestResults(
      markAssessment('A', new Map([[12, { kind: 'vector', value: v20.answer.value }]])),
    );
    expect(results.v_cross?.outcome).toBe('misconception');
    expect(results.v_cross?.caught?.[0].id).toBe('V20_CROSS_MIDDLE_SIGN' satisfies MisconceptionId);
  });
});
