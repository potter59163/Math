import { CONFIG } from '@/lib/config';
import type { StoredAnswer } from '@/lib/core/answerJson';
import type { Profile } from '@/lib/director/types';
import type { ItemRef } from '@/lib/core/types';
import { itemsDoneIn } from '@/lib/learner/progress';
import type { LearnerProfile } from '@/lib/learner/types';
import { enabledTopics, packOf, registeredTopics } from '@/lib/topics';
import type { TopicId } from '@/lib/topics/types';

// The pre-test and the post-test across the wire.

export type AssessmentPhase = 'pre' | 'post';

/**
 * The research's test: matrices (RESEARCH §4). The welcome screen offers it, and its rows, forms and
 * addresses are the ones they always were. The vector test sits beside it (`testedTopics`), with rows of
 * its own (lib/server/store.ts), since Potter opened it on 25 Nov 2026.
 */
export const ASSESSED_TOPIC = 'matrix';

/** The topics whose pre/post test the app offers: each switched-on topic whose pack has one. */
export function testedTopics(enabled: readonly string[] = CONFIG.topics): TopicId[] {
  return enabledTopics(enabled).filter((topic) => packOf(topic).assessment !== undefined);
}

export function isTestedTopic(
  topic: unknown,
  enabled: readonly string[] = CONFIG.topics,
): topic is TopicId {
  return testedTopics(enabled).some((tested) => tested === topic);
}

/** RESEARCH §4: 14 items in about 20 minutes. */
export const minutesFor = (items: number) => Math.round((items * 10) / 7);

/** How many items a topic's test has: its forms are built alike, so the first one says. */
export function testLengthOf(topic: TopicId): number {
  const test = packOf(topic).assessment;
  return test ? test.items(test.forms[0]).length : 0;
}

/** Where a topic's test lives. The matrix test keeps the addresses it always had. */
export function testPath(phase: AssessmentPhase, topic: TopicId): string {
  return topic === ASSESSED_TOPIC ? `/test/${phase}` : `/test/${phase}?topic=${topic}`;
}

export function testApi(phase: AssessmentPhase | 'status', topic: TopicId): string {
  const path = `/api/assessment/${phase}`;
  return topic === ASSESSED_TOPIC ? path : `${path}?topic=${topic}`;
}

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

/** The practice a topic's test counts: that topic's answers, and the matrix test keeps its own count. */
export function testedItemsDone(
  profile: Pick<LearnerProfile, 'itemsDone' | 'skills'> | null | undefined,
  topic: TopicId,
): number {
  if (topic === ASSESSED_TOPIC) return assessedItemsDone(profile);
  return profile ? itemsDoneIn(profile, topic) : 0;
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
