import { describe, expect, it, vi } from 'vitest';

// Vectors are switched on for this file only, as NEXT_PUBLIC_TOPICS=matrix,vector does in production.
vi.hoisted(() => {
  process.env.NEXT_PUBLIC_TOPICS = 'matrix,vector';
});

import { generate } from '@/lib/topics/matrix/generators';
import { applyAttempt, applyPretest, newLearnerProfile } from './profile';
import { ALL_UNITS, itemsDoneIn } from './progress';
import { recommendationFor } from './recommend';
import type { LearnerProfile, Student } from './types';

// The sentence คิว opens the lessons page with (SPEC §4), including what the pre-test changed.

const STUDENT: Student = { id: 'RECOMMEND-1', units: [...ALL_UNITS] };
const fresh = () => newLearnerProfile(STUDENT);

function answerDim(profile: LearnerProfile, right: boolean): LearnerProfile {
  const item = generate({ skill: 'dim', difficulty: profile.skills.dim?.level ?? 1, seed: 5 });
  const answer = right ? item.correct : { kind: 'dims' as const, rows: 97, cols: 98 };
  return applyAttempt(profile, { item, answer, hintLevel: 0, timeMs: 3000, at: 1 }).profile;
}

describe('recommendationFor (SPEC §4)', () => {
  it('starts a new student at the first skill', () => {
    expect(recommendationFor(fresh())).toEqual({ kind: 'start', skill: 'dim' });
  });

  it('carries on in a skill already begun', () => {
    expect(recommendationFor(answerDim(fresh(), false))).toEqual({ kind: 'carryOn', skill: 'dim' });
  });

  it('names the next skill once one has passed', () => {
    let profile = fresh();
    for (let n = 0; n < 6 && !profile.skills.dim?.passed; n += 1) profile = answerDim(profile, true);
    expect(profile.skills.dim?.passed).toBe(true);
    expect(recommendationFor(profile)).toEqual({ kind: 'next', skill: 'index' });
  });

  it('counts only the topic being learned, so a new topic starts from its start', () => {
    const matrixOnly = answerDim(fresh(), true);
    expect(itemsDoneIn(matrixOnly, 'matrix')).toBe(1);
    expect(itemsDoneIn(matrixOnly, 'vector')).toBe(0);
    const onVectors: LearnerProfile = {
      ...matrixOnly,
      student: { ...matrixOnly.student, activeTopic: 'vector' },
    };
    expect(recommendationFor(onVectors).kind).toBe('start');
  });
});

describe('after the pre-test (SPEC §4, §7.1)', () => {
  it('says how many skills are known and that the first one is a quick check', () => {
    const profile = applyPretest(
      fresh(),
      {
        dim: { outcome: 'correct' },
        index: { outcome: 'correct' },
        transpose: { outcome: 'other_wrong' },
      },
      { at: 0 },
    );
    expect(recommendationFor(profile)).toEqual({
      kind: 'pretest',
      skill: 'dim',
      start: 'quick',
      known: 2,
    });
  });

  it('says the first skill starts with a check when the test caught a mistake there', () => {
    const profile = applyPretest(
      fresh(),
      {
        dim: { outcome: 'misconception', caught: [{ id: 'M01_DIM_SWAP' }] },
        index: { outcome: 'correct' },
      },
      { at: 0 },
    );
    expect(recommendationFor(profile)).toEqual({
      kind: 'pretest',
      skill: 'dim',
      start: 'check',
      known: 1,
      misconception: 'M01_DIM_SWAP',
    });
  });

  it('says the first skill is new when the test got it wrong without a known mistake', () => {
    const profile = applyPretest(
      fresh(),
      { dim: { outcome: 'other_wrong' }, index: { outcome: 'correct' } },
      { at: 0 },
    );
    expect(recommendationFor(profile)).toEqual({
      kind: 'pretest',
      skill: 'dim',
      start: 'learn',
      known: 1,
    });
  });

  it('falls back to the plain start when the test left nothing to say', () => {
    const profile = applyPretest(fresh(), { dim: { outcome: 'other_wrong' } }, { at: 0 });
    expect(recommendationFor(profile)).toEqual({ kind: 'start', skill: 'dim' });
  });

  it('calls the next known skill a quick check, and a flagged one a check', () => {
    const known = answerDim(
      applyPretest(fresh(), { dim: { outcome: 'correct' }, index: { outcome: 'correct' } }, { at: 0 }),
      true,
    );
    expect(known.skills.dim?.passed).toBe(true);
    expect(recommendationFor(known)).toEqual({ kind: 'nextQuick', skill: 'index' });

    const flagged = answerDim(
      applyPretest(
        fresh(),
        {
          dim: { outcome: 'correct' },
          index: { outcome: 'misconception', caught: [{ id: 'M02_INDEX_SWAP' }] },
        },
        { at: 0 },
      ),
      true,
    );
    expect(recommendationFor(flagged)).toEqual({
      kind: 'nextCheck',
      skill: 'index',
      misconception: 'M02_INDEX_SWAP',
    });
  });
});
