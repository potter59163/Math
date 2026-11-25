import { CONFIG } from '@/lib/config';
import { th, type ChoiceKey, type WorkedKey } from '@/lib/content/th';
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
  type MarkedResponse as MatrixMarked,
} from './assessment';
import { generate, regenerate } from './generators';
import { attemptContext, EXAMPLES, FOCUS_RULE, sceneWord, skillWord, TOPIC_WORD } from './llm';
import {
  CATALOG,
  catalogEntry,
  probeLevel,
  probeLevels,
  sceneFor,
  variantsOf,
} from './misconceptions';
import { conceptScene, introScene, remediationScene, revealScene } from './scenes';
import { levelsOf, SKILLS, skillById, type Skill, type SkillId } from './skills';
import { resolveMatrixTokens } from './tokens';
import type { MatrixItem, MatrixItemRef, MisconceptionId } from './types';
import { hintStep, workedSteps, type Step } from './worked';

// The matrix topic as the rest of the app sees it. Only an adapter: every rule, number and line of copy
// is where it was before topics, so matrices behave exactly as they did.

const UNITS: readonly Skill['unit'][] = [1, 2, 3, 4, 5];

/** Items reach a pack only from its own generators, through `packOf(ref.topic)`. */
function asMatrix(item: Item): MatrixItem {
  if (item.ref.topic !== 'matrix') throw new Error(`matrix pack: got a ${item.ref.topic} item`);
  return item as MatrixItem;
}

const FIRST_STEP_WORDING: Partial<Record<WorkedKey, string>> = th.hintFirstStep;

const lineOf = ({ labelKey, params, latex }: Step): WorkedLine => ({
  text: fillTokens(th.worked[labelKey], params),
  latex,
});

export const matrixPack: TopicPack = {
  id: 'matrix',
  titleTh: th.learn.topic,
  noteTh: th.learn.topicNote,
  units: UNITS.map((id) => ({ id, label: String(id), titleTh: th.units[id] })),
  openUnits: (student) => student.units,

  skills: SKILLS,
  skillById: (id) => skillById(id as SkillId),
  levelsOf: (id) => levelsOf(id as SkillId),

  generatorVersion: CONFIG.generatorVersion,
  generate: ({ skill, difficulty, seed, target, targetVariant }) =>
    generate({
      skill: skill as SkillId,
      difficulty,
      seed,
      target: target as MisconceptionId | undefined,
      targetVariant,
    }),
  regenerate: (ref: ItemRef) => regenerate(ref as MatrixItemRef),

  catalog: CATALOG,
  catalogEntry: (id) => catalogEntry(id as MisconceptionId),
  probeLevel: (skill, id, level, variant) =>
    probeLevel(skill as SkillId, id as MisconceptionId, level, variant),
  probeLevels: (skill, id, variant) =>
    probeLevels(skill as SkillId, id as MisconceptionId, variant),
  variantsOf: (id) => variantsOf(id as MisconceptionId),

  workedSteps: (item) => workedSteps(asMatrix(item)).map(lineOf),
  hints: {
    l1: (item) => th.hintL1[asMatrix(item).data.form],
    firstStep: (item) => {
      const [{ labelKey, params }] = workedSteps(asMatrix(item));
      return fillTokens(FIRST_STEP_WORDING[labelKey] ?? th.worked[labelKey], params);
    },
    step: (item) => lineOf(hintStep(asMatrix(item))),
  },

  scenes: {
    intro: (unit, options) => introScene(unit as Skill['unit'], options),
    concept: (skill, { avoid, ...options }) =>
      conceptScene(skill as SkillId, { ...options, avoid: avoid && asMatrix(avoid) }),
    remediate: (item, answer, caught, theme) =>
      remediationScene(
        asMatrix(item),
        answer,
        { id: caught.id as MisconceptionId, variant: caught.variant },
        theme,
      ),
    reveal: (item) => revealScene(asMatrix(item)),
    hasWorkedScene: ({ id, variant }, kind) =>
      sceneFor(id as MisconceptionId, { kind, variant }).template === 'worked_solution',
  },

  tokens: (item, answer, options) => resolveMatrixTokens(asMatrix(item), answer, options),

  llm: {
    topicWord: TOPIC_WORD,
    focusRule: FOCUS_RULE,
    examples: EXAMPLES,
    skillWord: (id) => skillWord(id as SkillId),
    sceneWord,
    attemptContext,
  },

  copy: {
    prompt: (item) => fillTokens(th.prompts[asMatrix(item).prompt.key], item.prompt.params),
    choiceLabel: (labelKey) => th.choices[labelKey as ChoiceKey],
    misconceptionShort: (id) => th.misconceptionShort[id as MisconceptionId],
    misconceptionHint: (id) => th.hints[id as MisconceptionId],
    misconceptionFeedback: (id, variant) => {
      const entry: string | Record<string, string> =
        th.feedback.misconceptions[id as MisconceptionId];
      if (typeof entry === 'string') return entry;
      return (variant !== undefined && entry[variant]) || th.hints[id as MisconceptionId];
    },
    slip: ([i, j]) => fillTokens(th.feedback.slip, { i: String(i), j: String(j) }),
  },

  assessment: {
    forms: ['A', 'B'],
    formFor,
    items: (form) => assessmentForm(form as AssessmentFormId),
    mark: (form, answers) => markAssessment(form as AssessmentFormId, answers),
    score: (marked) => scoreOf(marked as readonly MatrixMarked[]),
    pretestResults: (marked) => pretestResults(marked as readonly MatrixMarked[]),
  },
};
