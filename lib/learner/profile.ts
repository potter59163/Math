import { CONFIG } from '@/lib/config';
import { classify } from '@/lib/core/classify';
import type { Level } from '@/lib/core/types';
import { comboAfter, xpFor } from '@/lib/practice/rewards';
import { CATALOG, catalogEntry } from '@/lib/topics/matrix/misconceptions';
import { skillById, type SkillId } from '@/lib/topics/matrix/skills';
import type { MisconceptionId } from '@/lib/topics/matrix/types';
import { guessRate, updateKnown } from './bkt';
import { nextLevel } from './difficulty';
import { meetsMastery } from './mastery';
import { isOpen, onCaught, onTargetedAnswer } from './misconceptionStatus';
import { isUnitPassed, nextSkill } from './progress';
import type {
  AttemptEvent,
  AttemptOutcome,
  HintLevel,
  LearnerConfig,
  LearnerProfile,
  LocalStudent,
  PretestResult,
  SkillState,
} from './types';

// The learner model of SPEC §7: (profile, event, config) → profile. Pure, and any clock time is passed
// in. The functions are generic so that a profile carrying more fields keeps them.

export function newLearnerProfile(student: LocalStudent): LearnerProfile {
  return {
    student,
    counter: 0,
    xp: 0,
    combo: 0,
    bestCombo: 0,
    itemsDone: 0,
    skills: {},
    misconceptions: {},
    clipsSeen: [],
    lastReviewAt: 0,
  };
}

function newSkillState(pKnown: number): SkillState {
  return {
    pKnown,
    level: 1,
    attempts: [],
    passed: false,
    wrongStreak: 0,
    stuck: false,
    lastSeen: 0,
  };
}

export function skillStateOf(
  profile: Pick<LearnerProfile, 'skills'>,
  id: SkillId,
  config: LearnerConfig = CONFIG,
): SkillState {
  return profile.skills[id] ?? newSkillState(config.bkt.pInit);
}

export function levelOf(profile: Pick<LearnerProfile, 'skills'>, id: SkillId): Level {
  return profile.skills[id]?.level ?? 1;
}

/** Suspected or active, in catalog order, for one skill or for all of them. */
export function openMisconceptions(
  profile: Pick<LearnerProfile, 'misconceptions'>,
  skill?: SkillId,
): MisconceptionId[] {
  return CATALOG.filter(
    ({ id, skills }) =>
      isOpen(profile.misconceptions[id]) && (skill === undefined || skills.includes(skill)),
  ).map(({ id }) => id);
}

/**
 * "ระหว่างแก้ misconception" in R6. A pre-test flag on a skill not started yet is waiting, not being
 * fixed, and must not hold back reviews until the student gets there.
 */
export function isFixingMisconception(
  profile: Pick<LearnerProfile, 'misconceptions' | 'skills'>,
): boolean {
  return openMisconceptions(profile).some((id) =>
    catalogEntry(id).skills.some((skill) => (profile.skills[skill]?.attempts.length ?? 0) > 0),
  );
}

export function applyPretest<P extends LearnerProfile>(
  profile: P,
  results: Partial<Record<SkillId, PretestResult>>,
  { at }: { at: number },
  config: LearnerConfig = CONFIG,
): P {
  const skills = { ...profile.skills };
  const misconceptions = { ...profile.misconceptions };
  const { correct, misconception, otherWrong } = config.bktFromPretest;

  for (const [key, result] of Object.entries(results)) {
    const id = key as SkillId;
    if (result.outcome === 'correct') {
      skills[id] = {
        ...newSkillState(correct),
        level: config.mastery.minLevelToPass as Level,
        pretestCorrect: true,
      };
      continue;
    }
    skills[id] = newSkillState(result.outcome === 'misconception' ? misconception : otherWrong);
    for (const { id: caught, variant } of result.caught ?? []) {
      const when = { itemNo: profile.itemsDone, at, variant };
      misconceptions[caught] = {
        ...onCaught(misconceptions[caught], when, config),
        fromPretest: true,
      };
    }
  }
  return { ...profile, skills, misconceptions };
}

/** Closes the open item with this answer. There is no second try (SPEC §4). */
export function applyAttempt<P extends LearnerProfile>(
  profile: P,
  { item, answer, hintLevel, timeMs, at }: AttemptEvent,
  config: LearnerConfig = CONFIG,
): { profile: P; outcome: AttemptOutcome } {
  const classification = classify(item, answer);
  const correct = classification.type === 'correct';
  const countsCorrect = correct && !(config.hintL2CountsAsWrong && hintLevel >= 2);
  const { skill, difficulty, target } = item.ref;
  const itemNo = profile.itemsDone + 1;

  let { misconceptions } = profile;
  let resolved: MisconceptionId | null = null;
  let bonusXp = 0;

  const aimedAt = target && misconceptions[target];
  if (target && aimedAt) {
    const result = onTargetedAnswer(aimedAt, countsCorrect, { itemNo, at }, config);
    const firstFix = result.resolved && !aimedAt.rewarded;
    if (result.resolved) resolved = target;
    if (firstFix) bonusXp = config.xp.misconceptionResolved;
    misconceptions = {
      ...misconceptions,
      [target]: firstFix ? { ...result.state, rewarded: true } : result.state,
    };
  }
  if (classification.type === 'misconception') {
    const id = classification.id as MisconceptionId;
    const when = { itemNo, at, variant: classification.variant };
    misconceptions = { ...misconceptions, [id]: onCaught(misconceptions[id], when, config) };
  }

  const before = skillStateOf(profile, skill, config);
  const attempts = [
    ...before.attempts,
    { level: difficulty, countsCorrect, clean: correct && hintLevel === 0, timeMs },
  ];
  const pKnown = updateKnown(before.pKnown, countsCorrect, guessRate(item, config), config);
  const { maxLevel, unit } = skillById(skill);
  const level = nextLevel(before.level, attempts, pKnown, maxLevel, config);
  // Any right answer ends the streak: the screen has just said so, even if BKT reads a deep hint as
  // wrong. R7 then starts counting again, so a stuck student is not sent to the solution every time.
  const streak = correct ? 0 : before.wrongStreak + 1;
  const stuck = streak >= config.stuckAfterWrong;
  const state: SkillState = {
    ...before,
    pKnown,
    level,
    attempts,
    wrongStreak: stuck ? 0 : streak,
    stuck: !correct && (before.stuck || stuck),
    lastSeen: itemNo,
  };
  const hasOpen = openMisconceptions({ misconceptions }, skill).length > 0;
  const passed = before.passed || meetsMastery(state, hasOpen, config);

  const xp = xpFor(correct, hintLevel);
  const combo = comboAfter(profile.combo, correct, hintLevel);
  const next: P = {
    ...profile,
    xp: profile.xp + xp + bonusXp,
    combo,
    bestCombo: Math.max(profile.bestCombo, combo),
    itemsDone: itemNo,
    skills: { ...profile.skills, [skill]: { ...state, passed } },
    misconceptions,
    current: undefined,
  };

  const justPassed = passed && !before.passed;
  return {
    profile: next,
    outcome: {
      classification,
      xp,
      bonusXp,
      skillPassed: justPassed ? skill : null,
      unitPassed: justPassed && isUnitPassed(next, unit) ? unit : null,
      allPassed: justPassed && nextSkill(next) === null,
      resolved,
      stuck,
      levelChange: (level - before.level) as AttemptOutcome['levelChange'],
    },
  };
}

export function advanceHint<P extends LearnerProfile>(profile: P): P {
  const { current } = profile;
  if (!current || current.hintLevel === 3) return profile;
  const hintLevel = (current.hintLevel + 1) as HintLevel;
  return { ...profile, current: { ...current, hintLevel } };
}

/** Seen or skipped, it does not play again. "ไม่เข้าใจ" can still bring up the concept scene. */
export function markClipSeen<P extends LearnerProfile>(profile: P, skill: SkillId): P {
  return profile.clipsSeen.includes(skill)
    ? profile
    : { ...profile, clipsSeen: [...profile.clipsSeen, skill] };
}

/** R1 stops replaying a scene after two views, and a skip counts: the student chose not to watch. */
export function noteSceneSeen<P extends LearnerProfile>(profile: P, id: MisconceptionId): P {
  const state = profile.misconceptions[id];
  if (!state) return profile;
  const seen = { ...state, scenesSeen: state.scenesSeen + 1 };
  return { ...profile, misconceptions: { ...profile.misconceptions, [id]: seen } };
}
