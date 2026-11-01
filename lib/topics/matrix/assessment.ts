import { classify } from '@/lib/core/classify';
import { deriveSeed } from '@/lib/core/prng';
import { Rational } from '@/lib/core/rational';
import type { Answer, Classification, Level } from '@/lib/core/types';
import type { PretestResult } from '@/lib/learner/types';
import { generate } from './generators';
import { det } from './ops';
import type { SkillId } from './skills';
import type { GenerateRequest, MatrixItem, MisconceptionId } from './types';

// The pre-test and post-test of RESEARCH §4. Forms A and B come from the same generators on fixed seeds,
// so they have the same structure and different numbers, and every student sits exactly the same form.

export type FormId = 'A' | 'B';

const flat = (value: readonly (readonly Rational[])[]) => value.flat();
const hasZero = (value: readonly (readonly Rational[])[]) => flat(value).some((c) => c.isZero());

interface BlueprintRow {
  skill: SkillId;
  level: Level;
  target?: MisconceptionId;
  targetVariant?: string;
  /** The rest of the row's spec, which the generator alone does not promise. */
  fits(item: MatrixItem): boolean;
}

/** RESEARCH §4, in order. */
export const BLUEPRINT: readonly BlueprintRow[] = [
  // 1. A 2×3 or 3×2.
  {
    skill: 'dim',
    level: 1,
    fits: ({ data }) => data.form === 'dim' && data.A.length * data.A[0].length === 6,
  },
  // 2. 3×3 with no repeats, asking aᵢⱼ with i ≠ j.
  {
    skill: 'index',
    level: 1,
    fits: ({ data }) => data.form === 'index' && data.i !== data.j && data.A.length === 3,
  },
  // 3. 2×3 with no repeats.
  {
    skill: 'transpose',
    level: 2,
    fits: ({ data }) => {
      if (data.form !== 'transpose' || data.A.length !== 2 || data.A[0].length !== 3) return false;
      const cells = flat(data.A).map(String);
      return new Set(cells).size === cells.length;
    },
  },
  // 4. A − B where B has at least two negative cells.
  {
    skill: 'addsub',
    level: 2,
    target: 'M05_SUB_REVERSED',
    fits: ({ data, correct }) =>
      data.form === 'addsub' &&
      data.op === 'sub' &&
      correct.kind === 'matrix' &&
      flat(data.B).filter((cell) => cell.sign() < 0).length >= 2,
  },
  // 5. kA, k ∈ {2, 3}, no zeros.
  {
    skill: 'scalar',
    level: 1,
    fits: ({ data }) =>
      data.form === 'scalar' && (data.k === 2 || data.k === 3) && !hasZero(data.A),
  },
  // 6. AB exists and m ≠ p.
  {
    skill: 'mult_defined',
    level: 1,
    fits: ({ data, correct }) =>
      data.form === 'mult_defined' &&
      data.order === 'AB' &&
      correct.kind === 'dims' &&
      correct.rows !== correct.cols,
  },
  // 7. A and B both 2×3, so no product.
  {
    skill: 'mult_defined',
    level: 1,
    target: 'M08_MULT_DIM_RULE',
    targetVariant: 'SAME_DIMS',
    fits: ({ data, correct }) =>
      data.form === 'mult_defined' &&
      correct.kind === 'undefined' &&
      data.dimsA.rows === 2 &&
      data.dimsA.cols === 3 &&
      data.dimsB.rows === 2 &&
      data.dimsB.cols === 3,
  },
  // 8. 2×2 · 2×2 where every candidate differs.
  {
    skill: 'mult',
    level: 1,
    target: 'M09_MULT_ELEMENTWISE',
    fits: ({ data, diagnostics }) => {
      if (data.form !== 'mult') return false;
      const has = (id: MisconceptionId) => diagnostics.some((found) => found.id === id);
      return has('M09_MULT_ELEMENTWISE') && has('M10_MULT_ROW_ROW') && has('M11_MULT_COMMUTATIVE');
    },
  },
  // 9. "AB = BA เสมอ", true or false.
  {
    skill: 'mult_noncomm',
    level: 1,
    fits: ({ data }) => data.form === 'noncomm_statement' && data.statement === 'always_equal',
  },
  // 10. bc ≠ 0, det ≠ 0.
  {
    skill: 'det2',
    level: 1,
    fits: ({ data }) =>
      data.form === 'det2' && !data.A[0][1].mul(data.A[1][0]).isZero() && !det(data.A).isZero(),
  },
  // 11. 3×3 with one zero.
  {
    skill: 'det3',
    level: 2,
    fits: ({ data }) => data.form === 'det3' && flat(data.A).filter((c) => c.isZero()).length === 1,
  },
  // 12. n = 3, det A = d, find det(kA).
  {
    skill: 'det_props',
    level: 2,
    target: 'M14_DET_SCALAR_LINEAR',
    fits: ({ data }) => data.form === 'det_scaled' && data.n === 3 && Math.abs(data.k) >= 2,
  },
  // 13. |det| ∈ {2, 3, 4}, no zeros.
  {
    skill: 'inv2',
    level: 2,
    fits: ({ data }) => {
      if (data.form !== 'inv2' || hasZero(data.A)) return false;
      const size = det(data.A).abs();
      return [2, 3, 4].some((value) => size.equals(Rational.of(value)));
    },
  },
  // 14. One zero, but det ≠ 0.
  {
    skill: 'invertible',
    level: 2,
    target: 'M19_INV_ZERO_ENTRY',
    fits: ({ data }) =>
      data.form === 'invertible' &&
      data.A.length === 2 &&
      flat(data.A).filter((c) => c.isZero()).length === 1 &&
      !det(data.A).isZero(),
  },
];

const TOTAL_ITEMS = BLUEPRINT.length;
const MAX_TRIES = 2000;

function itemFor(form: FormId, itemNo: number, row: BlueprintRow): MatrixItem {
  const { skill, level, target, targetVariant } = row;
  for (let attempt = 0; attempt < MAX_TRIES; attempt += 1) {
    const request: GenerateRequest = {
      skill,
      difficulty: level,
      seed: deriveSeed(`assessment:${form}:${itemNo}`, attempt),
      ...(target && { target }),
      ...(targetVariant && { targetVariant }),
    };
    let item: MatrixItem;
    try {
      item = generate(request);
    } catch {
      continue;
    }
    if (row.fits(item)) return item;
  }
  throw new Error(`assessment: no item for form ${form} row ${itemNo}`);
}

const built = new Map<FormId, MatrixItem[]>();

/** Fixed for ever by its seeds (RESEARCH §4.1). If a teacher rejects an item, change the seed base. */
export function assessmentForm(form: FormId): MatrixItem[] {
  const known = built.get(form);
  if (known) return known;
  const items = BLUEPRINT.map((row, index) => itemFor(form, index + 1, row));
  built.set(form, items);
  return items;
}

/** Half of everyone starts on each form, and each student gets the other one afterwards. */
export function formFor(userId: string, phase: 'pre' | 'post'): FormId {
  const startsOnA = deriveSeed(`form:${userId}`, 0) % 2 === 0;
  return (phase === 'pre') === startsOnA ? 'A' : 'B';
}

export interface MarkedResponse {
  itemNo: number;
  item: MatrixItem;
  answer: Answer | null;
  classification: Classification | null;
  correct: boolean;
}

/** An item not answered is simply not right, and tells us nothing about any misconception. */
export function markAssessment(
  form: FormId,
  answers: ReadonlyMap<number, Answer | null>,
): MarkedResponse[] {
  return assessmentForm(form).map((item, index) => {
    const itemNo = index + 1;
    const answer = answers.get(itemNo) ?? null;
    const classification = answer ? classify(item, answer) : null;
    return {
      itemNo,
      item,
      answer,
      classification,
      correct: classification?.type === 'correct',
    };
  });
}

export const scoreOf = (marked: readonly MarkedResponse[]) => ({
  score: marked.filter(({ correct }) => correct).length,
  total: TOTAL_ITEMS,
});

/** What each skill's items showed, for the path that follows (SPEC §7.1). */
export function pretestResults(
  marked: readonly MarkedResponse[],
): Partial<Record<SkillId, PretestResult>> {
  const bySkill = new Map<SkillId, MarkedResponse[]>();
  for (const response of marked) {
    const skill = response.item.ref.skill;
    bySkill.set(skill, [...(bySkill.get(skill) ?? []), response]);
  }
  const results: Partial<Record<SkillId, PretestResult>> = {};
  for (const [skill, responses] of bySkill) {
    const caught = responses.flatMap(({ classification }) =>
      classification?.type === 'misconception'
        ? [{ id: classification.id as MisconceptionId, variant: classification.variant }]
        : [],
    );
    results[skill] = responses.every(({ correct }) => correct)
      ? { outcome: 'correct' }
      : caught.length > 0
        ? { outcome: 'misconception', caught }
        : { outcome: 'other_wrong' };
  }
  return results;
}
