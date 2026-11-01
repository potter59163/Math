import { CONFIG } from '@/lib/config';
import type { Level } from '@/lib/core/types';
import { SKILLS, type SkillId } from '@/lib/topics/matrix/skills';
import { hasPassed, inOpenUnit } from './progress';
import type { LearnerConfig, LearnerProfile } from './types';

/** SPEC §7.4. Every skill has an L2, so a review can always be built. */
export const REVIEW_LEVEL: Level = 2;

type Reviewing = Pick<LearnerProfile, 'student' | 'skills'>;

/** Passed skills of the open units, seen longest ago first. Ties keep teaching order. */
function passedByAge(profile: Reviewing): SkillId[] {
  const seen = (id: SkillId) => profile.skills[id]?.lastSeen ?? 0;
  return SKILLS.map(({ id }) => id)
    .filter((id) => inOpenUnit(profile, id) && hasPassed(profile, id))
    .sort((a, b) => seen(a) - seen(b));
}

export function longestUnseen(profile: Reviewing): SkillId | null {
  return passedByAge(profile)[0] ?? null;
}

/**
 * The timing half of R6 (SPEC §7.4): a skill to review, if one is due. Whether the student is in a
 * state to get it is for the rules to say.
 */
export function reviewDue(profile: LearnerProfile, config: LearnerConfig = CONFIG): SkillId | null {
  const { every, lookback } = config.interleave;
  if (profile.itemsDone - profile.lastReviewAt < every) return null;
  const oldest = longestUnseen(profile);
  if (oldest === null) return null;
  const age = profile.itemsDone - (profile.skills[oldest]?.lastSeen ?? 0);
  return age >= lookback ? oldest : null;
}
