import { CONFIG } from '@/lib/config';
import type { StoredAnswer } from '@/lib/core/answerJson';
import type { Profile } from '@/lib/director/types';
import type { ItemRef } from '@/lib/core/types';
import type { LearnerProfile } from '@/lib/learner/types';
import { packOf, registeredTopics } from '@/lib/topics';

// The pre-test and the post-test across the wire.

export type AssessmentPhase = 'pre' | 'post';

/**
 * Only matrices have a pre/post test in the app. Its rows are keyed by user and phase, so a second
 * topic's test needs that unique index to take the topic too (docs/VECTORS.md §6.1).
 */
export const ASSESSED_TOPIC = 'matrix';

/**
 * The practice the tests count: the assessed topic's alone. Every topic adds to the one `itemsDone`, so
 * this takes away the answers on other topics' skills, and a profile with none of those (every profile
 * from before vectors) counts exactly as it always did. A guest's carried-over progress is checked
 * field by field, so the two may disagree, and the count then stops at zero.
 */
export function assessedItemsDone(
  profile: Pick<LearnerProfile, 'itemsDone' | 'skills'> | null | undefined,
): number {
  if (!profile) return 0;
  const elsewhere = registeredTopics()
    .filter((topic) => topic !== ASSESSED_TOPIC)
    .flatMap((topic) => packOf(topic).skills)
    .reduce((sum, { id }) => sum + (profile.skills[id]?.attempts.length ?? 0), 0);
  return Math.max(0, profile.itemsDone - elsewhere);
}

export type TestBlock = 'already_learning' | 'too_early';

/**
 * A pre-test after practice or a post-test before any would not measure what it claims. Each can be taken
 * only once, and there is no teacher screen to reset one that went wrong (RESEARCH §3).
 */
export function testBlock(phase: AssessmentPhase, itemsDone: number): TestBlock | null {
  if (phase === 'pre') return itemsDone > 0 ? 'already_learning' : null;
  return itemsDone < CONFIG.postTestAfterItems ? 'too_early' : null;
}

export interface AssessmentScore {
  score: number;
  total: number;
}

export type AssessmentStatus = Record<AssessmentPhase, AssessmentScore | null>;

export interface AssessmentForm {
  phase: AssessmentPhase;
  /** Only references: the browser builds the items with the same engine, and nothing says which is right. */
  refs: ItemRef[];
  /** Already taken, so the screen shows the result instead of the test. */
  done: AssessmentScore | null;
}

export interface AssessmentAnswer {
  itemNo: number;
  answer: StoredAnswer | null;
  timeMs: number;
}

export interface AssessmentSubmission {
  startedAt: number;
  answers: AssessmentAnswer[];
}

export interface AssessmentResult extends AssessmentScore {
  /** After a pre-test, the student's path as it now stands. */
  profile: Profile | null;
}
