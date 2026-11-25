import { th } from '@/lib/content/th';
import { fillTokens } from '@/lib/core/tokens';
import type { Level } from '@/lib/core/types';
import type { LearnerProfile, UnitId } from '@/lib/learner/types';
import { activeTopicOf, DEFAULT_TOPIC, packOf, skillOf } from '@/lib/topics';
import type { SkillId, TopicId } from '@/lib/topics/types';
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
  topic: TopicId = DEFAULT_TOPIC,
): { skill: SkillId; level: Level } {
  const skills = packOf(topic).skills.filter(({ unit }) => units.includes(unit));
  const round = position % (skills.length * LEVELS.length);
  const skill = skills[Math.floor(round / LEVELS.length)];
  const level = Math.min(LEVELS[round % LEVELS.length], skill.maxLevel) as Level;
  return { skill: skill.id, level };
}

/**
 * The items answered in one topic: how far along its path a student is. Not `itemsDone`, which
 * counts every topic, so that a student who switches starts the new topic at its beginning and
 * comes back to the old one where they left it. With one topic only the two are equal, since
 * every answer adds one to each and the pre-test adds to neither.
 */
export function itemsDoneIn(profile: Pick<LearnerProfile, 'skills'>, topic: TopicId): number {
  return packOf(topic).skills.reduce(
    (sum, { id }) => sum + (profile.skills[id]?.attempts.length ?? 0),
    0,
  );
}

/** One path, from the items done in its topic. `attempt` is missing when the session starts. */
export function fixedCandidates(profile: LearnerProfile, attempt?: AttemptContext): Candidate[] {
  const pack = packOf(activeTopicOf(profile.student));
  const units = pack.openUnits(profile.student);
  const { skill, level } = fixedStepAt(units, itemsDoneIn(profile, pack.id), pack.id);
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
        skill: skillOf(skill).nameTh,
        level: String(level),
      }),
    },
  ]);
}
