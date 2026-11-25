import { thVector, type VectorWorkedKey } from '@/lib/content/th.vector';
import { fillTokens } from '@/lib/core/tokens';
import type { Answer } from '@/lib/core/types';
import type { SceneSpecOf, WorkedBeat, WorkedSceneStep } from '@/lib/topics/matrix/scenes/types';
import type { VectorItem } from '../types';
import { workedSteps, type Step } from '../worked';
import type { ScenePurpose } from './types';
import { voicedBeats, type VoiceId } from './voice';

// "ดูวิธีทำ" of a vector item: the shared worked_solution template (SCENES §3.5) with the steps of
// lib/topics/vector/worked.ts. Each step says what a clip says about the same idea, with its recording.

const STEP_MS = 3000;

/** Steps that come once per component: the first says what to do, and the rest to do the same. */
const PER_COMPONENT: Partial<Record<VectorWorkedKey, readonly [VoiceId, VoiceId]>> = {
  points_component: ['v_comp.comp_1', 'v_comp.comp_next'],
  vertex_component: ['v_worked.vertex_point', 'v_comp.comp_next'],
  linear_scale: ['v_comp.scale_1', 'v_comp.scale_next'],
  linear_component: ['v_comp.sum', 'v_comp.comp_next'],
  unit_component: ['v_unit.divide', 'v_comp.comp_next'],
};

const STEP_VOICE: Record<VectorWorkedKey, VoiceId> = {
  quantity_rule: 'v_sort.end',
  quantity_answer: 'v_worked.answer',
  figure_length: 'v_worked.figure_length',
  figure_equal_result: 'v_arrow.result_equal',
  figure_negative_result: 'v_arrow.flip',
  geom_reverse: 'v_arrow.negate',
  geom_half: 'v_worked.geom_half',
  geom_translate: 'v_arrow.slide',
  geom_chain: 'v_arrow.result',
  geom_same: 'v_worked.answer',
  points_component: 'v_comp.comp_1',
  points_result: 'v_comp.done',
  vertex_rule: 'v_worked.vertex_rule',
  vertex_bc: 'v_worked.vertex_side',
  vertex_component: 'v_worked.vertex_point',
  vertex_result: 'v_comp.done',
  linear_read: 'v_comp.read',
  linear_scale: 'v_comp.scale_1',
  linear_component: 'v_comp.sum',
  linear_result: 'v_comp.done',
  parallel_k: 'v_par.find_k',
  parallel_solve: 'v_par.solve',
  magnitude_vector: 'v_mag.combine',
  magnitude_square: 'v_mag.square',
  magnitude_root: 'v_mag.root',
  unit_norm: 'v_unit.norm',
  unit_component: 'v_unit.divide',
  unit_result: 'v_worked.unit_result',
  scaled_result: 'v_unit.scale',
  dircos_result: 'v_unit.dircos',
  dot_pairs: 'v_dot.end',
  dot_cos: 'v_dot.cos',
  dot_polar: 'v_dot.formula',
  angle_dot: 'v_angle.dot',
  angle_norms: 'v_angle.norms',
  cos_result: 'v_angle.cos',
  angle_result: 'v_angle.fan',
  perp_dot: 'v_dot.perp_setup',
  perp_solve: 'v_dot.solve',
  perp_property_rule: 'v_worked.perp_rule',
  perp_property_norms: 'v_worked.perp_norms',
  perp_property_solve: 'v_worked.perp_solve',
  cross_i: 'v_cross.cover_i',
  cross_j: 'v_cross.cover_j',
  cross_k: 'v_cross.cover_k',
  cross_check: 'v_cross.check',
  cross_result: 'v_cross.result',
  area_sides: 'v_area.sides',
  area_cross: 'v_area.cross',
  area_norm: 'v_area.norm',
  area_half: 'v_area.half',
  volume_cross: 'v_area.base',
  volume_dot: 'v_area.dot',
  volume_abs: 'v_area.abs',
};

/** Six taps at most, as for matrices. */
const MAX_BEATS = 6;

/** One beat per step, or the per-component steps of one kind in one beat when that is too many. */
function groupSteps(steps: Step[]): Step[][] {
  if (steps.length <= MAX_BEATS) return steps.map((step) => [step]);
  const groups: Step[][] = [];
  for (const step of steps) {
    const last = groups.at(-1);
    if (last && step.labelKey in PER_COMPONENT && last[0].labelKey === step.labelKey) {
      last.push(step);
    } else {
      groups.push([step]);
    }
  }
  return groups;
}

/** The line of each beat, which is the line of the first step in it. */
function voicesOf(groups: Step[][], form: VectorItem['data']['form']): VoiceId[] {
  const started = new Set<VectorWorkedKey>();
  return groups.map(([{ labelKey }]) => {
    const per = PER_COMPONENT[labelKey];
    if (per) {
      const line = started.has(labelKey) ? per[1] : per[0];
      started.add(labelKey);
      return line;
    }
    if (labelKey === 'magnitude_vector' && form === 'distance') return 'v_mag.points';
    return STEP_VOICE[labelKey];
  });
}

/** SCENES §3.5 on a vector item, from `workedSteps`, so every number is the engine's. */
export function vectorWorkedScene(
  item: Pick<VectorItem, 'data' | 'correct'>,
  purpose: ScenePurpose,
  studentAnswer?: Answer,
): SceneSpecOf<'worked_solution'> {
  const groups = groupSteps(workedSteps(item));
  const beats = groups.map((_, index): WorkedBeat => `step_${index + 1}`);
  const steps: WorkedSceneStep[] = groups.flatMap((group, index) =>
    group.map((step) => ({
      text: fillTokens(thVector.worked[step.labelKey], step.params),
      latex: step.latex,
      beat: beats[index],
    })),
  );
  const lines = voicesOf(groups, item.data.form);
  const voice = Object.fromEntries(beats.map((beat, index) => [beat, lines[index]])) as Partial<
    Record<WorkedBeat, VoiceId>
  >;
  return {
    template: 'worked_solution',
    params: { steps },
    beats,
    captions: {},
    beatMs: voicedBeats(Object.fromEntries(beats.map((beat) => [beat, STEP_MS])), voice),
    voice,
    ...(studentAnswer && { compare: { studentAnswer } }),
    purpose,
  };
}
