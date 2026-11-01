import { CONFIG } from '@/lib/config';
import type { StoredAnswer } from '@/lib/core/answerJson';
import type { Profile } from '@/lib/director/types';
import type { MatrixItemRef } from '@/lib/topics/matrix/types';

// The pre-test and the post-test across the wire.

export type AssessmentPhase = 'pre' | 'post';

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
  refs: MatrixItemRef[];
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
