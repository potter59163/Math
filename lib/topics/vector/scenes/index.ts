import { thVector } from '@/lib/content/th.vector';
import { fillTokens } from '@/lib/core/tokens';
import type { Level } from '@/lib/core/types';
import type { ScenePurpose, SceneSpec, TopicPack } from '@/lib/topics/types';
import { generate } from '../generators';
import { SKILLS, type SkillId } from '../skills';
import type { VectorItem } from '../types';
import { workedSteps } from '../worked';

// A stand-in until the vector clips land (docs/VECTORS.md §5): every clip is the shared worked_solution
// template, filled from this pack's own worked steps. It has no voice, so each step shows for a fixed
// time. The clips branch replaces this file whole.

type WorkedSpec = Extract<SceneSpec, { template: 'worked_solution' }>;

const STEP_MS = 3000;
/** Six taps at most, as for matrices. */
const MAX_BEATS = 6;

function workedScene(item: VectorItem, purpose: ScenePurpose): WorkedSpec {
  const steps = workedSteps(item);
  const beatCount = Math.min(steps.length, MAX_BEATS);
  const beats = Array.from({ length: beatCount }, (_, i) => `step_${i + 1}` as const);
  return {
    template: 'worked_solution',
    params: {
      steps: steps.map(({ labelKey, params, latex }, i) => ({
        text: fillTokens(thVector.worked[labelKey], params),
        latex,
        beat: beats[Math.floor((i * beatCount) / steps.length)],
      })),
    },
    beats,
    captions: {},
    beatMs: Object.fromEntries(beats.map((beat) => [beat, STEP_MS])),
    voice: {},
    purpose,
  };
}

/** An example of the skill that is not `avoid`, so a clip never gives the item on screen away. */
function example(skill: SkillId, level: Level, seed: number, avoid?: VectorItem): VectorItem {
  const item = generate({ skill, difficulty: level, seed });
  if (!avoid || JSON.stringify(item.data) !== JSON.stringify(avoid.data)) return item;
  return generate({ skill, difficulty: level, seed: seed + 1 });
}

export const vectorScenes: TopicPack['scenes'] = {
  intro: (unit, { seed = 0 }) => {
    const first = SKILLS.find((skill) => skill.unit === unit);
    if (!first) throw new Error(`vector intro: unknown unit ${unit}`);
    return workedScene(example(first.id, 1, seed), 'intro');
  },
  concept: (skill, { seed, level = 1, avoid, purpose = 'concept' }) =>
    workedScene(example(skill as SkillId, level, seed, avoid as VectorItem | undefined), purpose),
  remediate: (item, answer, caught) => ({
    ...workedScene(item as VectorItem, 'remediate'),
    compare: { studentAnswer: answer, variant: caught.variant },
  }),
  reveal: (item) => workedScene(item as VectorItem, 'reveal'),
  // Every clip here is a worked solution, so "ดูวิธีทำ" may open the misconception's own one.
  hasWorkedScene: () => true,
};
