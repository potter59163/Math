import fc from 'fast-check';
import { describe, expect, it, vi } from 'vitest';

// Vectors are switched on for this file only, as NEXT_PUBLIC_TOPICS=matrix,vector will do in production.
vi.hoisted(() => {
  process.env.NEXT_PUBLIC_TOPICS = 'matrix,vector';
});

import { CONFIG } from '@/lib/config';
import type { Item } from '@/lib/core/types';
import { newProfile } from '@/lib/director/turn';
import type { Profile } from '@/lib/director/types';
import { applyAttempt } from '@/lib/learner/profile';
import { unknownAnswer } from '@/lib/sim/answers';
import { packOf, packOfSkill, type SkillId, type TopicId } from '@/lib/topics';
import { assessedItemsDone, testBlock } from './assessment';

// Every practice answer adds one to the single `itemsDone` of the profile, whatever its topic, and the
// matrix pre/post-test must count only the matrix ones (RESEARCH §3).

const AT = 1_800_000_000_000;

const student = (activeTopic: TopicId) =>
  newProfile({ id: 'MIX-1', units: [1, 2, 3, 4, 5], activeTopic });

/** One answer, recorded by the learner model as a practice answer is. */
function answer(profile: Profile, item: Item, right = true): Profile {
  return applyAttempt(profile, {
    item,
    answer: right ? item.correct : unknownAnswer(item),
    hintLevel: 0,
    timeMs: 5000,
    at: AT + profile.itemsDone * 60_000,
  }).profile;
}

/** `times` new items of one skill, each answered right. */
function practise(profile: Profile, skill: SkillId, times: number): Profile {
  let next = profile;
  for (let n = 0; n < times; n += 1) {
    const seed = 100 + next.itemsDone;
    next = answer(next, packOfSkill(skill).generate({ skill, difficulty: 1, seed }));
  }
  return next;
}

const gates = (profile: Profile) => ({
  pre: testBlock('pre', assessedItemsDone(profile)),
  post: testBlock('post', assessedItemsDone(profile)),
});

describe('the matrix tests with vectors switched on', () => {
  it('is switched on here', () => {
    expect(CONFIG.topics).toEqual(['matrix', 'vector']);
  });

  it.each([1, CONFIG.postTestAfterItems, CONFIG.postTestAfterItems + 5])(
    'keep the pre-test open and the post-test locked after %i vector items alone',
    (times) => {
      const profile = practise(student('vector'), 'v_quantity', times);
      expect(profile.itemsDone).toBe(times);
      expect(assessedItemsDone(profile)).toBe(0);
      expect(gates(profile)).toEqual({ pre: null, post: 'too_early' });
    },
  );

  it('count only the matrix items of mixed practice', () => {
    const mixed = practise(practise(student('matrix'), 'dim', 3), 'v_points', 7);
    expect(mixed.itemsDone).toBe(10);
    expect(assessedItemsDone(mixed)).toBe(3);
    expect(gates(mixed)).toEqual({ pre: 'already_learning', post: 'too_early' });

    const enough = practise(mixed, 'dim', CONFIG.postTestAfterItems - 3);
    expect(assessedItemsDone(enough)).toBe(CONFIG.postTestAfterItems);
    expect(gates(enough)).toEqual({ pre: 'already_learning', post: null });
  });

  // A few real items of each topic, answered again and again: what counts is the topic of the skill.
  const POOL: Record<TopicId, Item[]> = {
    matrix: ['dim', 'addsub', 'det2'].map((skill, seed) =>
      packOf('matrix').generate({ skill, difficulty: 1, seed }),
    ),
    vector: ['v_quantity', 'v_points', 'v_magnitude'].map((skill, seed) =>
      packOf('vector').generate({ skill, difficulty: 1, seed }),
    ),
  };

  it('count the matrix answers alone, in any order of topics, right or wrong', () => {
    const answers = fc.array(
      fc.record({
        topic: fc.constantFrom<TopicId>('matrix', 'vector'),
        pick: fc.nat(2),
        right: fc.boolean(),
      }),
      { maxLength: 2 * CONFIG.postTestAfterItems },
    );
    fc.assert(
      fc.property(answers, (sequence) => {
        const profile = sequence.reduce(
          (current, { topic, pick, right }) => answer(current, POOL[topic][pick], right),
          student('matrix'),
        );
        const matrixAnswers = sequence.filter(({ topic }) => topic === 'matrix').length;
        expect(profile.itemsDone).toBe(sequence.length);
        expect(assessedItemsDone(profile)).toBe(matrixAnswers);
      }),
      { numRuns: 1000 },
    );
  });
});
