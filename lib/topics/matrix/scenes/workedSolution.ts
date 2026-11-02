import { th } from '@/lib/content/th';
import { fillTokens } from '@/lib/core/tokens';
import type { Answer } from '@/lib/core/types';
import type { MatrixItem } from '../types';
import { workedSteps, type Step } from '../worked';
import type { ScenePurpose, SceneSpecOf, WorkedBeat, WorkedSceneStep } from './types';
import { timedBeats, type VoiceId } from './voice';

const STEP_MS = 3000;

/** Steps that come once per cell: the first says where to begin, and the rest say to do the same. */
const PER_CELL = {
  addsub_cell: ['sheet.cell_1', 'sheet.cell_2'],
  scalar_cell: ['sheet.cell_1', 'sheet.cell_2'],
  combo_cell: ['sheet.cell_1', 'sheet.cell_2'],
  mult_cell: ['bill.end_plain', 'bill.fill_rest'],
} as const satisfies Partial<Record<Step['labelKey'], readonly [VoiceId, VoiceId]>>;

/**
 * Most steps say what a clip says about the same idea, so they use its recording. That is one voice for
 * one idea, and it fitted the credits that were left (docs/DECISIONS.md).
 */
const STEP_VOICE: Record<
  Exclude<Step['labelKey'], keyof typeof PER_CELL | 'transpose_row'>,
  VoiceId
> = {
  dim_rows: 'table.count_rows',
  dim_cols: 'table.count_cols',
  dim_result: 'table.result',
  index_locate: 'cell.row',
  index_row: 'cell.hit',
  transpose_result: 'flip.done',
  addsub_dims: 'fit.blocks',
  addsub_undefined: 'fit.add_no',
  addsub_result: 'sheet.done',
  scalar_result: 'sheet.done',
  combo_result: 'sheet.done',
  mult_result: 'sheet.done',
  combo_scale_a: 'worked.scale',
  combo_scale_b: 'worked.scale',
  defined_inner: 'fit.mult_check',
  defined_result: 'fit.mult_ok',
  defined_undefined: 'fit.mult_no',
  abc_first: 'worked.abc_first',
  abc_second: 'worked.abc_second',
  noncomm_example: 'worked.noncomm_example',
  noncomm_example_swapped: 'worked.noncomm_example_swapped',
  noncomm_example_differ: 'order.differ',
  noncomm_ab: 'worked.noncomm_ab',
  noncomm_ba: 'worked.noncomm_ba',
  noncomm_same: 'worked.noncomm_same',
  noncomm_differ: 'order.differ',
  det2_formula: 'cross.result',
  det3_down: 'cross.down3',
  det3_up: 'cross.up3',
  det3_result: 'cross.result',
  det_scaled_rule: 'worked.det_scaled_rule',
  det_scaled_value: 'worked.det_scaled_value',
  det_product_rule: 'worked.det_product_rule',
  det_sum_add: 'sum.add_first',
  det_sum_det: 'sum.det_of_sum',
  det_transpose_rule: 'worked.det_transpose_rule',
  det_inverse_rule: 'worked.det_inverse_rule',
  invertible_det: 'worked.invertible_det',
  invertible_has: 'worked.invertible_has',
  invertible_none: 'worked.invertible_none',
  inv2_swap: 'recipe.swap',
  inv2_negate: 'recipe.negate',
  inv2_det: 'recipe.det',
  inv2_divide: 'recipe.divide',
};

/** The line of each beat, which is the line of the first step in it. */
function voicesOf(steps: WorkedParts['steps']): VoiceId[] {
  const started = new Set<Step['labelKey']>();
  return steps.map(([{ labelKey, params }]) => {
    if (labelKey === 'transpose_row') return `flip.row_${params?.i ?? 1}` as VoiceId;
    if (labelKey in PER_CELL) {
      const [first, rest] = PER_CELL[labelKey as keyof typeof PER_CELL];
      const line = started.has(labelKey) ? rest : first;
      started.add(labelKey);
      return line;
    }
    return STEP_VOICE[labelKey as keyof typeof STEP_VOICE];
  });
}

/** Six taps at most, which keeps the longest solution at 18 seconds. */
const MAX_BEATS = 6;

/** One beat per step, or per row of cells when a big matrix would make that too many taps. */
function groupSteps(steps: Step[]): Step[][] {
  if (steps.length <= MAX_BEATS) return steps.map((step) => [step]);
  const groups: Step[][] = [];
  let lastRow: string | null = null;
  for (const step of steps) {
    const row = step.cells?.length === 1 ? `${step.labelKey}:${step.cells[0][0]}` : null;
    if (row !== null && row === lastRow) groups[groups.length - 1].push(step);
    else groups.push([step]);
    lastRow = row;
  }
  return groups;
}

interface WorkedParts {
  steps: { text: string; latex: string; labelKey: Step['labelKey']; params?: Step['params'] }[][];
  purpose: ScenePurpose;
  studentAnswer?: Answer;
  variant?: string;
}

/** Each entry of `steps` is one beat. Earlier steps stay on screen, so a beat only adds to them. */
export function workedSceneOf({
  steps,
  purpose,
  studentAnswer,
  variant,
}: WorkedParts): SceneSpecOf<'worked_solution'> {
  const beats = steps.map((_, index): WorkedBeat => `step_${index + 1}`);
  const flat: WorkedSceneStep[] = steps.flatMap((group, index) =>
    group.map(({ text, latex }) => ({ text, latex, beat: beats[index] })),
  );
  const lines = voicesOf(steps);
  const voice = Object.fromEntries(beats.map((beat, index) => [beat, lines[index]])) as Partial<
    Record<WorkedBeat, VoiceId>
  >;
  return {
    template: 'worked_solution',
    params: { steps: flat },
    beats,
    captions: {},
    beatMs: timedBeats(Object.fromEntries(beats.map((beat) => [beat, STEP_MS])), voice),
    voice,
    ...(studentAnswer && { compare: { studentAnswer, variant } }),
    purpose,
  };
}

interface WorkedOptions {
  studentAnswer?: Answer;
  variant?: string;
}

/** SCENES §3.5, from `workedSteps`, so every number is the engine's. */
export function workedScene(
  item: Pick<MatrixItem, 'data' | 'correct'>,
  purpose: ScenePurpose,
  { studentAnswer, variant }: WorkedOptions = {},
): SceneSpecOf<'worked_solution'> {
  return workedSceneOf({
    steps: groupSteps(workedSteps(item)).map((group) =>
      group.map((step) => ({
        text: fillTokens(th.worked[step.labelKey], step.params),
        latex: step.latex,
        labelKey: step.labelKey,
        params: step.params,
      })),
    ),
    purpose,
    studentAnswer,
    variant,
  });
}
