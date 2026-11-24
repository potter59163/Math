import { classify } from '@/lib/core/classify';
import { deriveSeed } from '@/lib/core/prng';
import type { Answer, Classification, Level } from '@/lib/core/types';
import { generate } from './generators';
import { triple } from './ops';
import type { SkillId } from './skills';
import type { GenerateRequest, MisconceptionId, VectorItem } from './types';

// A pre-test and post-test for vectors, built like the matrix forms of RESEARCH §4: forms A and B
// come from the same generators on fixed seeds, so they share a structure and differ in numbers, and
// every student sits exactly the same form. They are not wired into the app yet (docs/VECTORS.md §6.1).

export type FormId = 'A' | 'B';

/** What a skill's items showed, in the shape of the learner model's pre-test result. */
export interface VectorPretestResult {
  outcome: 'correct' | 'misconception' | 'other_wrong';
  caught?: { id: MisconceptionId; variant?: string }[];
}

interface BlueprintRow {
  skill: SkillId;
  level: Level;
  target?: MisconceptionId;
  targetVariant?: string;
  /** The rest of the row's spec, which the generator alone does not promise. */
  fits(item: VectorItem): boolean;
}

const has = (item: VectorItem, id: MisconceptionId) => item.diagnostics.some((d) => d.id === id);

/** One item per skill, in teaching order, plus a second v_geom item so both V03 and V04 are tested. */
export const BLUEPRINT: readonly BlueprintRow[] = [
  // 1. Vector or scalar quantity.
  { skill: 'v_quantity', level: 1, target: 'V01_QUANTITY_MIX', fits: () => true },
  // 2. AB + AD in a parallelogram.
  { skill: 'v_geom', level: 2, target: 'V04_GEOM_ADD_JOIN_TIPS', fits: () => true },
  // 3. AB − AD in a parallelogram.
  { skill: 'v_geom', level: 2, target: 'V03_GEOM_SUB_DIRECTION', fits: () => true },
  // 4. AB from two points in space, with three non-zero components.
  {
    skill: 'v_points',
    level: 2,
    target: 'V05_POINTS_REVERSED',
    fits: ({ correct }) => correct.kind === 'vector' && correct.value.every((p) => !p.isZero()),
  },
  // 5. pu − qv, where both V06 and V07 can show.
  {
    skill: 'v_linear',
    level: 2,
    target: 'V07_COMBO_SIGN',
    fits: (item) => has(item, 'V06_SCALAR_PARTIAL'),
  },
  // 6. A parallel unknown in 3D.
  { skill: 'v_parallel', level: 2, target: 'V08_PARALLEL_RATIO_FLIP', fits: () => true },
  // 7. |v| in 3D whose answer has a root.
  {
    skill: 'v_magnitude',
    level: 2,
    target: 'V09_MAG_NO_ROOT',
    fits: (item) =>
      item.correct.kind === 'surd' &&
      !item.correct.value.isRational() &&
      has(item, 'V10_MAG_SUM_COMPONENTS'),
  },
  // 8. A unit vector with a whole length.
  {
    skill: 'v_unit',
    level: 2,
    target: 'V12_UNIT_SQUARED',
    fits: (item) => has(item, 'V13_UNIT_DIVIDE_SUM'),
  },
  // 9. u·v in 2D.
  { skill: 'v_dot', level: 1, target: 'V14_DOT_AS_DET', fits: () => true },
  // 10. An obtuse standard angle in 3D.
  { skill: 'v_angle', level: 2, target: 'V17_ANGLE_ABS', fits: () => true },
  // 11. A perpendicular unknown in 3D.
  { skill: 'v_perp', level: 2, target: 'V19_PERP_AS_PARALLEL', fits: () => true },
  // 12. u × v where all three cross misconceptions show.
  {
    skill: 'v_cross',
    level: 2,
    target: 'V20_CROSS_MIDDLE_SIGN',
    fits: (item) => has(item, 'V21_CROSS_ORDER') && has(item, 'V22_CROSS_COMPONENTWISE'),
  },
  // 13. A triangle in space.
  {
    skill: 'v_area',
    level: 2,
    target: 'V23_TRIANGLE_NO_HALF',
    fits: (item) => has(item, 'V24_AREA_DOT'),
  },
  // 14. A slanted box whose triple product is negative.
  {
    skill: 'v_volume',
    level: 2,
    target: 'V25_VOLUME_SIGNED',
    fits: (item) =>
      item.data.form === 'volume' &&
      triple(item.data.u, item.data.v, item.data.w).sign() < 0 &&
      has(item, 'V26_VOLUME_MAG_PRODUCT'),
  },
];

const TOTAL_ITEMS = BLUEPRINT.length;
const MAX_TRIES = 2000;

function itemFor(form: FormId, itemNo: number, row: BlueprintRow): VectorItem {
  const { skill, level, target, targetVariant } = row;
  for (let attempt = 0; attempt < MAX_TRIES; attempt += 1) {
    const request: GenerateRequest = {
      skill,
      difficulty: level,
      seed: deriveSeed(`vector-assessment:${form}:${itemNo}`, attempt),
      ...(target && { target }),
      ...(targetVariant && { targetVariant }),
    };
    let item: VectorItem;
    try {
      item = generate(request);
    } catch {
      continue;
    }
    if (row.fits(item)) return item;
  }
  throw new Error(`assessment: no vector item for form ${form} row ${itemNo}`);
}

const built = new Map<FormId, VectorItem[]>();

/** Fixed for ever by its seeds. If a teacher rejects an item, change the seed base. */
export function assessmentForm(form: FormId): VectorItem[] {
  const known = built.get(form);
  if (known) return known;
  const items = BLUEPRINT.map((row, index) => itemFor(form, index + 1, row));
  built.set(form, items);
  return items;
}

/** Half of everyone starts on each form, and each student gets the other one afterwards. */
export function formFor(userId: string, phase: 'pre' | 'post'): FormId {
  const startsOnA = deriveSeed(`vector-form:${userId}`, 0) % 2 === 0;
  return (phase === 'pre') === startsOnA ? 'A' : 'B';
}

export interface MarkedResponse {
  itemNo: number;
  item: VectorItem;
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
    return { itemNo, item, answer, classification, correct: classification?.type === 'correct' };
  });
}

export const scoreOf = (marked: readonly MarkedResponse[]) => ({
  score: marked.filter(({ correct }) => correct).length,
  total: TOTAL_ITEMS,
});

/** What each skill's items showed, for the path that follows. */
export function pretestResults(
  marked: readonly MarkedResponse[],
): Partial<Record<SkillId, VectorPretestResult>> {
  const bySkill = new Map<SkillId, MarkedResponse[]>();
  for (const response of marked) {
    const skill = response.item.ref.skill;
    bySkill.set(skill, [...(bySkill.get(skill) ?? []), response]);
  }
  const results: Partial<Record<SkillId, VectorPretestResult>> = {};
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
