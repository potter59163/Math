import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { SKILLS } from '@/lib/topics/matrix/skills';
import { newLearnerProfile } from './profile';
import { ALL_UNITS, isUnitPassed, isUnlocked, mapOf, nextSkill, skillStatus } from './progress';
import type { LearnerProfile, LocalStudent, SkillState, UnitId } from './types';

function student(units: readonly UnitId[] = ALL_UNITS): LocalStudent {
  return { id: 'ABC123-7', classCode: 'ABC123', seatNo: 7, units: [...units] };
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
