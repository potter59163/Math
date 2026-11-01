import { th } from '@/lib/content/th';
import { fillTokens } from '@/lib/core/tokens';
import type { Level } from '@/lib/core/types';
import type { LearnerProfile, UnitId } from '@/lib/learner/types';
import { SKILLS, skillById, type SkillId } from '@/lib/topics/matrix/skills';
import type { AttemptContext } from './candidates';
import { finalizeCandidates } from './candidates';
import { chosenScene, leadClip } from './scene';
import type { Candidate, NextStep } from './types';

// The control group of AI_DIRECTOR §3.1, for `ab_split`: the same path for everyone. No probes, no
// level changes, no reviews, no reasons on screen. Used by the simulator and /dev/director until
// students have a `condition`.

const LEVELS: readonly Level[] = [1, 1, 2, 2, 3];

const ONLY = 1;

/**
 * The item at a position on the path. After the last skill it starts over with the same pattern, on
 * new seeds, so that the time spent stays equal to the adaptive group's (AI_DIRECTOR §3.1).
 */
export function fixedStepAt(
  units: readonly UnitId[],
  position: number,
): { skill: SkillId; level: Level } {
  const skills = SKILLS.filter(({ unit }) => units.includes(unit));
  const round = position % (skills.length * LEVELS.length);
  const skill = skills[Math.floor(round / LEVELS.length)];
  const level = Math.min(LEVELS[round % LEVELS.length], skill.maxLevel) as Level;
  return { skill: skill.id, level };
}

/** One path, from the number of items done. `attempt` is missing when the session starts. */
export function fixedCandidates(profile: LearnerProfile, attempt?: AttemptContext): Candidate[] {
  const { skill, level } = fixedStepAt(profile.student.units, profile.itemsDone);
  const next: NextStep = { skill, level, purpose: 'practice' };

  const wrong = attempt && attempt.outcome.classification.type !== 'correct';
  const solution = wrong ? chosenScene({ kind: 'reveal', ref: attempt.item.ref }) : undefined;
  // Unlike the adaptive path, a right pre-test does not skip this (AI_DIRECTOR §3.1).
  const clip = profile.clipsSeen.includes(skill) ? undefined : leadClip(profile, next);
  const [scene, thenScene] = [solution, clip].filter((one) => one !== undefined);

  return finalizeCandidates([
    {
      rule: 'fixed',
      score: ONLY,
      ...(scene && { scene }),
      ...(thenScene && { thenScene }),
      next,
      stepKind: 'fixed',
      ruleReason: fillTokens(th.ruleReasons.fixed, {
        skill: skillById(skill).nameTh,
        level: String(level),
      }),
    },
  ]);
}
