import { CONFIG } from '@/lib/config';
import { classify } from '@/lib/core/classify';
import { deriveSeed } from '@/lib/core/prng';
import type { Answer, Classification, Level } from '@/lib/core/types';
import { generate, regenerate } from '@/lib/topics/matrix/generators';
import { skillById, type SkillId } from '@/lib/topics/matrix/skills';
import type { MatrixItem, MatrixItemRef, MisconceptionId } from '@/lib/topics/matrix/types';
import { isUnitPassed, nextSkill } from './path';
import { comboAfter, xpFor } from './rewards';
import type {
  FirstAttempt,
  HintLevel,
  LocalStudent,
  Profile,
  SkillProgress,
  UnitId,
} from './types';

// Phase 2 stand-in for the learner model and rules director of Phase 4: walk the skills in order and
// adjust the level. Pure, and it reproduces the rows of SPEC §7.3 that need no misconception status
// and no pre-test, without BKT.

const NEW_SKILL: SkillProgress = { level: 1, attempts: [], passed: false };

/** A generator failure is a bug, but one bad seed must not stop a class, so try the next few. */
const SEEDS_TO_TRY = 5;

export interface AttemptOutcome {
  classification: Classification;
  xp: number;
  skillPassed: SkillId | null;
  unitPassed: UnitId | null;
  allPassed: boolean;
}

export function newProfile(student: LocalStudent): Profile {
  return {
    student,
    counter: 0,
    xp: 0,
    combo: 0,
    bestCombo: 0,
    itemsDone: 0,
    skills: {},
    caught: {},
  };
}

export function levelOf(profile: Profile, id: SkillId): Level {
  return profile.skills[id]?.level ?? NEW_SKILL.level;
}

/** Null when the item cannot be rebuilt, which means its generator version has gone. */
export function rebuildItem(ref: MatrixItemRef): MatrixItem | null {
  try {
    return regenerate(ref);
  } catch {
    return null;
  }
}

export function currentItem(profile: Profile): MatrixItem | null {
  return profile.current ? rebuildItem(profile.current.ref) : null;
}

/** Opens the next item. An item already open stays, so a reload shows the same numbers. */
export function issueItem(profile: Profile): Profile {
  if (currentItem(profile)) return profile;
  const skill = nextSkill(profile);
  if (skill === null) return { ...profile, current: undefined };

  const difficulty = levelOf(profile, skill);
  let failure: unknown;
  for (let offset = 0; offset < SEEDS_TO_TRY; offset += 1) {
    const counter = profile.counter + offset;
    try {
      const seed = deriveSeed(profile.student.id, counter);
      const { ref } = generate({ skill, difficulty, seed });
      return { ...profile, counter: counter + 1, current: { ref, hintLevel: 0 } };
    } catch (error) {
      failure = error;
    }
  }
  throw failure;
}

export function advanceHint(profile: Profile): Profile {
  const { current } = profile;
  if (!current || current.hintLevel === 3) return profile;
  const hintLevel = (current.hintLevel + 1) as HintLevel;
  return { ...profile, current: { ...current, hintLevel } };
}

function nextLevel(level: Level, attempts: FirstAttempt[], maxLevel: Level): Level {
  const { upAfterCorrect, downAfterWrong } = CONFIG.standInRules;

  if (attempts[attempts.length - 1].countsCorrect) {
    const atLevel = attempts.filter((attempt) => attempt.level === level).slice(-upAfterCorrect);
    const rises = atLevel.length === upAfterCorrect && atLevel.every((a) => a.countsCorrect);
    return rises && level < maxLevel ? ((level + 1) as Level) : level;
  }

  const recent = attempts.slice(-downAfterWrong);
  const falls = recent.length === downAfterWrong && recent.every((a) => !a.countsCorrect);
  return falls && level > 1 ? ((level - 1) as Level) : level;
}

/** Conditions 2 and 3 of Mastered (SPEC §7.1). P(L) and misconception status arrive in Phase 4. */
function meetsPass(attempts: FirstAttempt[]): boolean {
  const clean = attempts.filter((attempt) => attempt.clean);
  return (
    clean.length >= CONFIG.mastery.minFirstTryCorrect &&
    clean.some((attempt) => attempt.level >= CONFIG.mastery.minLevelToPass)
  );
}

function bump(caught: Profile['caught'], id: MisconceptionId): Profile['caught'] {
  return { ...caught, [id]: (caught[id] ?? 0) + 1 };
}

/** Closes the open item with this answer. There is no second try (SPEC §4). */
export function submitAttempt(
  profile: Profile,
  item: MatrixItem,
  answer: Answer,
): { profile: Profile; outcome: AttemptOutcome } {
  const hintLevel = profile.current?.hintLevel ?? 0;
  const classification = classify(item, answer);
  const correct = classification.type === 'correct';
  const { skill, difficulty } = item.ref;
  const { unit, maxLevel } = skillById(skill);

  const before = profile.skills[skill] ?? NEW_SKILL;
  const attempts: FirstAttempt[] = [
    ...before.attempts,
    {
      level: difficulty,
      countsCorrect: correct && !(CONFIG.hintL2CountsAsWrong && hintLevel >= 2),
      clean: correct && hintLevel === 0,
    },
  ];
  const progress: SkillProgress = {
    level: nextLevel(before.level, attempts, maxLevel),
    attempts,
    passed: before.passed || meetsPass(attempts),
  };

  const xp = xpFor(correct, hintLevel);
  const combo = comboAfter(profile.combo, correct, hintLevel);

  const next: Profile = {
    ...profile,
    xp: profile.xp + xp,
    combo,
    bestCombo: Math.max(profile.bestCombo, combo),
    itemsDone: profile.itemsDone + 1,
    skills: { ...profile.skills, [skill]: progress },
    caught:
      classification.type === 'misconception'
        ? bump(profile.caught, classification.id as MisconceptionId)
        : profile.caught,
    current: undefined,
  };

  const justPassed = progress.passed && !before.passed;
  return {
    profile: next,
    outcome: {
      classification,
      xp,
      skillPassed: justPassed ? skill : null,
      unitPassed: justPassed && isUnitPassed(next, unit) ? unit : null,
      allPassed: justPassed && nextSkill(next) === null,
    },
  };
}
