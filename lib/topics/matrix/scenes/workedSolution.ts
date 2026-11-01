import { th } from '@/lib/content/th';
import { fillTokens } from '@/lib/core/tokens';
import type { Answer } from '@/lib/core/types';
import type { MatrixItem } from '../types';
import { workedSteps, type Step } from '../worked';
import type { ScenePurpose, SceneSpecOf, WorkedBeat, WorkedSceneStep } from './types';

const STEP_MS = 3000;

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
  steps: { text: string; latex: string }[][];
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
    group.map((step) => ({ ...step, beat: beats[index] })),
  );
  return {
    template: 'worked_solution',
    params: { steps: flat },
    beats,
    captions: {},
    beatMs: Object.fromEntries(beats.map((beat) => [beat, STEP_MS])),
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
      })),
    ),
    purpose,
    studentAnswer,
    variant,
  });
}
