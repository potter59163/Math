import { thVector } from '@/lib/content/th.vector';
import { fillTokens } from '@/lib/core/tokens';
import type { Item, ItemRef } from '@/lib/core/types';
import type { TopicPack, WorkedLine } from '@/lib/topics/types';
import {
  assessmentForm,
  formFor,
  markAssessment,
  pretestResults,
  scoreOf,
  type FormId as AssessmentFormId,
  type MarkedResponse as VectorMarked,
} from './assessment';
import { workedLine } from './display';
import { generate, regenerate, VECTOR_GENERATOR_VERSION } from './generators';
import { attemptContext, EXAMPLES, FOCUS_RULE, sceneWord, skillWord, TOPIC_WORD } from './llm';
import { CATALOG, catalogEntry, probeLevel, probeLevels, variantsOf } from './misconceptions';
import { vectorScenes } from './scenes';
import { levelsOf, SKILLS, skillById, UNITS, type SkillId } from './skills';
import { resolveVectorTokens } from './tokens';
import type { MisconceptionId, VectorItem, VectorItemRef } from './types';
import { hintStep, workedSteps, type Step } from './worked';

// Vectors as the rest of the app sees them (docs/VECTORS.md §6). Only an adapter: every rule, number and
// line of copy is the engine's own, in lib/topics/vector and lib/content/th.vector.ts.

/** Items reach a pack only from its own generators, through `packOf(ref.topic)`. */
function asVector(item: Item): VectorItem {
  if (item.ref.topic !== 'vector') throw new Error(`vector pack: got a ${item.ref.topic} item`);
  return item as VectorItem;
}

const lineOf = (step: Step): WorkedLine => workedLine(step);

const isVectorUnit = (unit: number): boolean => (UNITS as readonly number[]).includes(unit);

export const vectorPack: TopicPack = {
  id: 'vector',
  titleTh: thVector.topic.title,
  noteTh: thVector.topic.note,
  units: UNITS.map((id) => ({ id, label: thVector.unitBadges[id], titleTh: thVector.units[id] })),
  // Stored `student.units` are matrix units, so a student who has none of these has them all open.
  openUnits: (student) => {
    const own = student.units.filter(isVectorUnit);
    return own.length > 0 ? own : UNITS;
  },

  skills: SKILLS,
  skillById: (id) => skillById(id as SkillId),
  levelsOf: (id) => levelsOf(id as SkillId),

  generatorVersion: VECTOR_GENERATOR_VERSION,
  generate: ({ skill, difficulty, seed, target, targetVariant }) =>
    generate({
      skill: skill as SkillId,
      difficulty,
      seed,
      target: target as MisconceptionId | undefined,
      targetVariant,
    }),
  regenerate: (ref: ItemRef) => regenerate(ref as VectorItemRef),

  catalog: CATALOG,
  catalogEntry: (id) => catalogEntry(id as MisconceptionId),
  probeLevel: (skill, id, level, variant) =>
    probeLevel(skill as SkillId, id as MisconceptionId, level, variant),
  probeLevels: (skill, id, variant) =>
    probeLevels(skill as SkillId, id as MisconceptionId, variant),
  variantsOf: (id) => variantsOf(id as MisconceptionId),

  workedSteps: (item) => workedSteps(asVector(item)).map(lineOf),
  hints: {
    l1: (item) => thVector.hintL1[asVector(item).data.form],
    firstStep: (item) => lineOf(workedSteps(asVector(item))[0]).text,
    step: (item) => lineOf(hintStep(asVector(item))),
  },

  scenes: vectorScenes,

  tokens: (item, answer, options) => resolveVectorTokens(asVector(item), answer, options),

  llm: {
    topicWord: TOPIC_WORD,
    focusRule: FOCUS_RULE,
    examples: EXAMPLES,
    skillWord: (id) => skillWord(id as SkillId),
    sceneWord,
    attemptContext,
  },

  copy: {
    prompt: (item) => {
      const { key, params } = asVector(item).prompt;
      return fillTokens(thVector.prompts[key], params);
    },
    choiceLabel: (labelKey) => thVector.choices[labelKey as keyof typeof thVector.choices],
    misconceptionShort: (id) => thVector.misconceptionShort[id as MisconceptionId],
    misconceptionHint: (id) => thVector.hints[id as MisconceptionId],
    // No misconception has named variants yet, so every variant reads the same.
    misconceptionFeedback: (id) =>
      fillTokens(thVector.feedback.misconception, {
        name: thVector.misconceptionNames[id as MisconceptionId],
        hint: thVector.hints[id as MisconceptionId],
      }),
    slip: ([i]) => fillTokens(thVector.feedback.slip, { i: String(i) }),
  },

  // In the pack, not in the app: lib/sync/assessment.ts wires in the matrix test only (VECTORS §6.1).
  assessment: {
    forms: ['A', 'B'],
    formFor,
    items: (form) => assessmentForm(form as AssessmentFormId),
    mark: (form, answers) => markAssessment(form as AssessmentFormId, answers),
    score: (marked) => scoreOf(marked as readonly VectorMarked[]),
    pretestResults: (marked) => pretestResults(marked as readonly VectorMarked[]),
  },
};
