import { th } from '@/lib/content/th';
import { fillTokens } from '@/lib/core/tokens';
import type { Answer } from '@/lib/core/types';
import type { MatrixItem } from '../types';
import { workedSteps, type Step } from '../worked';
import type { ScenePurpose, SceneSpecOf, WorkedBeat, WorkedSceneStep } from './types';
import { timedBeats, type VoiceId } from './voice';

const STEP_MS = 3000;

/** These four only say every cell is done, so they share one recorded line. */
const ALL_CELLS: ReadonlySet<Step['labelKey']> = new Set([
  'addsub_result',
  'scalar_result',
  'combo_result',
  'mult_result',
]);

const voiceOfStep = (labelKey: Step['labelKey']): VoiceId =>
  ALL_CELLS.has(labelKey) ? 'worked.all_cells' : (`worked.${labelKey}` as VoiceId);

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
  steps: { text: string; latex: string; labelKey: Step['labelKey'] }[][];
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
  const voice = Object.fromEntries(
    beats.map((beat, index) => [beat, voiceOfStep(steps[index][0].labelKey)]),
  ) as Partial<Record<WorkedBeat, VoiceId>>;
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
      })),
    ),
    purpose,
    studentAnswer,
    variant,
  });
}
