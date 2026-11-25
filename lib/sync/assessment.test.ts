import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { CONFIG } from '@/lib/config';
import { newLearnerProfile } from '@/lib/learner/profile';
import type { SkillState } from '@/lib/learner/types';
import { packOf } from '@/lib/topics';
import { assessedItemsDone, testBlock } from './assessment';

describe('testBlock', () => {
  it('opens the pre-test only before the first practice item', () => {
    expect(testBlock('pre', 0)).toBeNull();
    expect(testBlock('pre', 1)).toBe('already_learning');
  });

  it('opens the post-test only after enough practice', () => {
    expect(testBlock('post', 0)).toBe('too_early');
    expect(testBlock('post', CONFIG.postTestAfterItems - 1)).toBe('too_early');
    expect(testBlock('post', CONFIG.postTestAfterItems)).toBeNull();
  });
});

/** A skill's state holding this many first attempts. Nothing else in it bears on the count. */
const stateWith = (attempts: number): SkillState => ({
  pKnown: 0.5,
  level: 1,
  attempts: Array.from({ length: attempts }, () => ({
    level: 1,
    countsCorrect: true,
    clean: true,
    timeMs: 4000,
  })),
  passed: false,
  wrongStreak: 0,
  stuck: false,
  lastSeen: 0,
});

const MATRIX_SKILLS = packOf('matrix').skills.map(({ id }) => id);
const VECTOR_SKILLS = packOf('vector').skills.map(({ id }) => id);

/**
 * Any profile with no vector attempt, which is every profile stored so far: matrix skills with any
 * history, an id no pack knows, and vector skills never answered. `itemsDone` need not match the
 * attempts, since a guest's carried-over progress is checked field by field (lib/server/account.ts).
 */
const matrixOnly = fc
  .record({
    itemsDone: fc.oneof(fc.nat({ max: 2 * CONFIG.postTestAfterItems }), fc.nat({ max: 5000 })),
    answered: fc.dictionary(fc.constantFrom(...MATRIX_SKILLS, 'retired_skill'), fc.nat(40)),
    untouched: fc.subarray(VECTOR_SKILLS),
  })
  .map(({ itemsDone, answered, untouched }) => ({
    ...newLearnerProfile({ id: 'ABC123-7', units: [1, 2, 3, 4, 5] }),
    itemsDone,
    skills: Object.fromEntries([
      ...Object.entries(answered).map(([id, attempts]) => [id, stateWith(attempts)] as const),
      ...untouched.map((id) => [id, stateWith(0)] as const),
    ]),
  }));

describe('assessedItemsDone', () => {
  it('is every item done for a profile with no vector attempt, so each test opens as before', () => {
    fc.assert(
      fc.property(matrixOnly, (profile) => {
        expect(assessedItemsDone(profile)).toBe(profile.itemsDone);
        for (const phase of ['pre', 'post'] as const) {
          expect(testBlock(phase, assessedItemsDone(profile))).toBe(
            testBlock(phase, profile.itemsDone),
          );
        }
      }),
      { numRuns: 1000 },
    );
  });

  it('is nothing before there is a profile', () => {
    expect(assessedItemsDone(null)).toBe(0);
    expect(assessedItemsDone(undefined)).toBe(0);
  });
});
