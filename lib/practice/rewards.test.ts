import { describe, expect, it } from 'vitest';
import { CONFIG } from '@/lib/config';
import { newLearnerProfile } from '@/lib/learner/profile';
import type { LearnerProfile, MisconceptionState, SkillState } from '@/lib/learner/types';
import { badgesOf, comboAfter, xpFor } from './rewards';

describe('badgesOf (SPEC §11)', () => {
  const passed: SkillState = {
    pKnown: 0.99,
    level: 2,
    attempts: [],
    passed: true,
    wrongStreak: 0,
    stuck: false,
    lastSeen: 1,
  };
  const fix = (rewarded: boolean): MisconceptionState => ({
    status: 'active',
    count: 2,
    fixStreak: 0,
    scenesSeen: 1,
    openedAtItem: 5,
    openedAtMs: 0,
    lastCaughtAtItem: 5,
    rewarded,
  });
  const base = (): LearnerProfile =>
    newLearnerProfile({ id: 'A-1', units: [4, 3] });

  it('starts empty', () => {
    expect(badgesOf(base())).toEqual([]);
  });

  it('gives one per passed unit, in order', () => {
    const profile = base();
    profile.skills = { mult_defined: passed, mult: passed, mult_noncomm: passed };
    expect(badgesOf(profile)).toEqual([{ kind: 'unit', unit: 3 }]);
    profile.skills = {
      ...profile.skills,
      det2: passed,
      det3: passed,
      det_props: passed,
    };
    expect(badgesOf(profile).map((badge) => badge.kind === 'unit' && badge.unit)).toEqual([3, 4]);
  });

  it('gives the fix badge once a misconception was fixed, and keeps it after a relapse', () => {
    const profile = base();
    profile.misconceptions = { M09_MULT_ELEMENTWISE: fix(false) };
    expect(badgesOf(profile)).toEqual([]);
    profile.misconceptions = { M09_MULT_ELEMENTWISE: fix(true) };
    expect(badgesOf(profile)).toEqual([{ kind: 'fixed' }]);
  });
});

describe('xpFor (SPEC §11)', () => {
  it('pays 10 with no hint, 7 after L1 and 3 after L2 or L3', () => {
    expect(xpFor(true, 0)).toBe(10);
    expect(xpFor(true, 1)).toBe(7);
    expect(xpFor(true, 2)).toBe(3);
    expect(xpFor(true, 3)).toBe(3);
  });

  it('pays nothing for a wrong answer, whatever the hints', () => {
    for (const level of [0, 1, 2, 3] as const) expect(xpFor(false, level)).toBe(0);
  });

  it('takes its numbers from CONFIG', () => {
    expect(xpFor(true, 0)).toBe(CONFIG.xp.firstTry);
    expect(xpFor(true, 1)).toBe(CONFIG.xp.withL1Hint);
    expect(xpFor(true, 2)).toBe(CONFIG.xp.withDeepHint);
  });
});

describe('comboAfter (SPEC §11)', () => {
  it('grows on a correct answer with at most an L1 hint', () => {
    expect(comboAfter(4, true, 0)).toBe(5);
    expect(comboAfter(4, true, 1)).toBe(5);
  });

  it('holds on a correct answer after L2 or L3', () => {
    expect(comboAfter(4, true, 2)).toBe(4);
    expect(comboAfter(4, true, 3)).toBe(4);
  });

  it('resets on a wrong answer', () => {
    expect(comboAfter(4, false, 0)).toBe(0);
    expect(comboAfter(4, false, 3)).toBe(0);
  });
});
