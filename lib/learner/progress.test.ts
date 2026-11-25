import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { SKILLS } from '@/lib/topics/matrix/skills';
import { unknownAnswer } from '@/lib/sim/answers';
import { generate } from '@/lib/topics/matrix/generators';
import { applyAttempt, applyPretest, newLearnerProfile } from './profile';
import {
  ALL_UNITS,
  awaitsCheck,
  isUnitPassed,
  isUnlocked,
  mapOf,
  nextSkill,
  skillStatus,
} from './progress';
import type { LearnerProfile, Student, SkillState, UnitId } from './types';

function student(units: readonly UnitId[] = ALL_UNITS): Student {
  return { id: 'ABC123-7', units: [...units] };
}

const passed: SkillState = {
  pKnown: 0.99,
  level: 2,
  attempts: [],
  passed: true,
  wrongStreak: 0,
  stuck: false,
  lastSeen: 1,
};

function withPassed(profile: LearnerProfile, ...ids: (keyof LearnerProfile['skills'])[]) {
  const skills = { ...profile.skills };
  for (const id of ids) skills[id] = passed;
  return { ...profile, skills };
}

describe('the path through the skills (SPEC §3, §4)', () => {
  it('starts on the first skill of the first open unit', () => {
    expect(nextSkill(newLearnerProfile(student()))).toBe('dim');
    expect(nextSkill(newLearnerProfile(student([3])))).toBe('mult_defined');
    expect(nextSkill(newLearnerProfile(student([4, 5])))).toBe('det2');
  });

  it('is null once every open skill has passed', () => {
    const done = withPassed(
      newLearnerProfile(student([3])),
      'mult_defined',
      'mult',
      'mult_noncomm',
    );
    expect(nextSkill(done)).toBeNull();
  });

  it('counts a prereq in a closed unit as passed', () => {
    const profile = newLearnerProfile(student([3]));
    expect(isUnlocked(profile, 'mult_defined')).toBe(true);
    expect(isUnlocked(profile, 'mult')).toBe(false);
  });

  it('locks a skill until its prereqs pass', () => {
    const profile = newLearnerProfile(student());
    expect(isUnlocked(profile, 'dim')).toBe(true);
    expect(isUnlocked(profile, 'index')).toBe(false);
    const afterDim = withPassed(profile, 'dim');
    expect(isUnlocked(afterDim, 'index')).toBe(true);
    expect(isUnlocked(afterDim, 'addsub')).toBe(true);
    expect(isUnlocked(afterDim, 'scalar')).toBe(false);
  });

  it('labels each skill for the map', () => {
    const profile = withPassed(newLearnerProfile(student()), 'dim');
    expect(skillStatus(profile, 'dim')).toBe('passed');
    expect(skillStatus(profile, 'index')).toBe('current');
    expect(skillStatus(profile, 'addsub')).toBe('open');
    expect(skillStatus(profile, 'scalar')).toBe('locked');
  });

  it('never points at a locked skill, whatever has passed', () => {
    fc.assert(
      fc.property(
        fc.subarray(SKILLS.map(({ id }) => id)),
        fc.subarray([...ALL_UNITS], { minLength: 1 }),
        (ids, units) => {
          const profile = withPassed(newLearnerProfile(student(units)), ...ids);
          const next = nextSkill(profile);
          if (next !== null) expect(isUnlocked(profile, next)).toBe(true);
        },
      ),
      { numRuns: 1000 },
    );
  });

  it('lists only the open units, in order, and marks finished ones', () => {
    const profile = withPassed(
      newLearnerProfile(student([5, 3])),
      'mult_defined',
      'mult',
      'mult_noncomm',
    );
    const map = mapOf(profile);
    expect(map.map(({ unit }) => unit)).toEqual([3, 5]);
    expect(map[0].passed).toBe(true);
    expect(map[1].passed).toBe(false);
    expect(map[0].skills.map(({ id }) => id)).toEqual(['mult_defined', 'mult', 'mult_noncomm']);
    expect(isUnitPassed(profile, 3)).toBe(true);
  });
});

describe('skills the pre-test found known (SPEC §7.1, Potter 25 Nov 2026)', () => {
  // Right on dim and index, wrong on transpose, nothing else asked.
  const tested = () =>
    applyPretest(
      newLearnerProfile(student()),
      {
        dim: { outcome: 'correct' },
        index: { outcome: 'correct' },
        transpose: { outcome: 'other_wrong' },
      },
      { at: 0 },
    );

  it('open what follows them before their own check', () => {
    const profile = tested();
    expect(isUnlocked(profile, 'transpose')).toBe(true);
    expect(isUnlocked(profile, 'addsub')).toBe(true);
    expect(skillStatus(profile, 'transpose')).toBe('current');
    expect(skillStatus(profile, 'dim')).toBe('open');
  });

  it('wait for their check until nothing is left to learn, then come in teaching order', () => {
    const profile = tested();
    expect(awaitsCheck(profile, 'dim')).toBe(true);
    expect(awaitsCheck(profile, 'transpose')).toBe(false);
    expect(nextSkill(profile)).toBe('transpose');

    const rest = SKILLS.map(({ id }) => id).filter((id) => id !== 'dim' && id !== 'index');
    expect(nextSkill(withPassed(profile, ...rest))).toBe('dim');
    expect(nextSkill(withPassed(profile, ...rest, 'dim'))).toBe('index');
    expect(nextSkill(withPassed(profile, ...rest, 'dim', 'index'))).toBeNull();
  });

  it('become a skill to learn after a wrong check, and leave what follows open', () => {
    const item = generate({ skill: 'dim', difficulty: 2, seed: 11 });
    const { profile: wrong } = applyAttempt(tested(), {
      item,
      answer: unknownAnswer(item),
      hintLevel: 0,
      timeMs: 4000,
      at: 1,
    });
    expect(wrong.skills.dim?.passed).toBe(false);
    expect(awaitsCheck(wrong, 'dim')).toBe(false);
    expect(nextSkill(wrong)).toBe('dim');
    expect(isUnlocked(wrong, 'index')).toBe(true);
    expect(isUnlocked(wrong, 'transpose')).toBe(true);
  });
});
