import { describe, expect, it } from 'vitest';
import type { SkillState } from '@/lib/learner/types';
import { allSkills } from '@/lib/topics';
import { guestProgressFor, startingProfile } from './account';

const state: SkillState = {
  pKnown: 0.4,
  level: 1,
  attempts: [{ level: 1, countsCorrect: true, clean: true, timeMs: 1200 }],
  passed: false,
  wrongStreak: 0,
  stuck: false,
  lastSeen: 1,
};

const guest = (skills: Record<string, SkillState>, clipsSeen: string[]) => ({
  counter: 3,
  xp: 30,
  combo: 2,
  bestCombo: 2,
  itemsDone: 3,
  skills,
  misconceptions: {},
  clipsSeen,
  lastReviewAt: 0,
});

describe('a guest profile carried over', () => {
  it('keeps matrix progress', () => {
    const profile = startingProfile('user-1', 'game', guest({ dim: state }, ['dim']));
    expect(profile.skills.dim).toEqual(state);
    expect(profile.xp).toBe(30);
    expect(profile.student).toEqual({ id: 'user-1', units: [1, 2, 3, 4, 5], theme: 'game' });
  });

  it('keeps both topics once both are registered', () => {
    const schema = guestProgressFor([...allSkills().map(({ id }) => id), 'v_points']);
    const parsed = schema.safeParse(guest({ dim: state, v_points: state }, ['dim', 'v_points']));
    expect(parsed.success).toBe(true);
    expect(parsed.data?.skills).toEqual({ dim: state, v_points: state });
  });

  it('drops a profile with a skill of no registered topic, as it always has', () => {
    const profile = startingProfile('user-1', 'game', guest({ dim: state, physics: state }, []));
    expect(profile.skills).toEqual({});
    expect(profile.xp).toBe(0);
  });
});
