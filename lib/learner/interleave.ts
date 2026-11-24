import { CONFIG } from '@/lib/config';
import type { Level } from '@/lib/core/types';
import { activeTopicOf, packOf } from '@/lib/topics';
import type { SkillId, TopicId } from '@/lib/topics/types';
import { hasPassed, inOpenUnit } from './progress';
import type { LearnerConfig, LearnerProfile } from './types';

/** SPEC §7.4. Every skill has an L2, so a review can always be built. */
export const REVIEW_LEVEL: Level = 2;

type Reviewing = Pick<LearnerProfile, 'student' | 'skills'>;

/** Passed skills of one topic's open units, seen longest ago first. Ties keep teaching order. */
function passedByAge(profile: Reviewing, topic: TopicId): SkillId[] {
  const seen = (id: SkillId) => profile.skills[id]?.lastSeen ?? 0;
  return packOf(topic)
    .skills.map(({ id }) => id)
    .filter((id) => inOpenUnit(profile, id) && hasPassed(profile, id))
    .sort((a, b) => seen(a) - seen(b));
}

/** Reviews stay in the topic being learned, by default the student's own. */
export function longestUnseen(
  profile: Reviewing,
  topic: TopicId = activeTopicOf(profile.student),
): SkillId | null {
  return passedByAge(profile, topic)[0] ?? null;
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
