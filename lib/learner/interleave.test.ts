import { describe, expect, it } from 'vitest';
import type { SkillId } from '@/lib/topics/matrix/skills';
import { longestUnseen, reviewDue } from './interleave';
import { newLearnerProfile } from './profile';
import type { LearnerProfile, SkillState } from './types';

const passedAt = (lastSeen: number): SkillState => ({
  pKnown: 0.99,
  level: 2,
  attempts: [],
  passed: true,
  wrongStreak: 0,
  stuck: false,
  lastSeen,
});

function profile(
  itemsDone: number,
  seen: Partial<Record<SkillId, number>>,
  extra: Partial<LearnerProfile> = {},
): LearnerProfile {
  const skills: LearnerProfile['skills'] = {};
  for (const [id, lastSeen] of Object.entries(seen)) {
    skills[id as SkillId] = passedAt(lastSeen);
  }
  return {
    ...newLearnerProfile({ id: 'A-1', classCode: 'AAAAAA', seatNo: 1, units: [1, 2, 3] }),
    itemsDone,
    skills,
    ...extra,
  };
}

describe('reviewDue (SPEC §7.4)', () => {
  it('finds a passed skill not seen in the last 10 items', () => {
    expect(reviewDue(profile(13, { dim: 3 }))).toBe('dim');
  });

  it('counts 10 items exactly: seen 9 items ago is too recent', () => {
    expect(reviewDue(profile(12, { dim: 3 }))).toBeNull();
    expect(reviewDue(profile(13, { dim: 3 }))).toBe('dim');
  });

  it('comes at most every 6 items after the last review', () => {
    const lately = (itemsDone: number) => profile(itemsDone, { dim: 1 }, { lastReviewAt: 12 });
    expect(reviewDue(lately(17))).toBeNull();
    expect(reviewDue(lately(18))).toBe('dim');
  });

  it('picks the skill unseen the longest', () => {
    expect(reviewDue(profile(30, { index: 12, dim: 5, transpose: 18 }))).toBe('dim');
  });

  it('ignores a skill that has not passed', () => {
    const open = profile(30, {});
    open.skills.dim = { ...passedAt(1), passed: false };
    expect(reviewDue(open)).toBeNull();
  });

  it('ignores a skill in a unit that is closed now', () => {
    const closed = profile(30, { dim: 1 });
    closed.student = { ...closed.student, units: [3] };
    expect(reviewDue(closed)).toBeNull();
  });
});

describe('longestUnseen', () => {
  it('finds the passed skill seen longest ago, however recent', () => {
    expect(longestUnseen(profile(4, { index: 3, dim: 2 }))).toBe('dim');
  });

  it('breaks a tie by teaching order', () => {
    expect(longestUnseen(profile(4, { transpose: 2, dim: 2 }))).toBe('dim');
  });

  it('is null with nothing passed', () => {
    expect(longestUnseen(profile(4, {}))).toBeNull();
  });
});
