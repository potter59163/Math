import fc from 'fast-check';
import { describe, expect, it, vi } from 'vitest';

// Vectors are switched on for this file only, as NEXT_PUBLIC_TOPICS=matrix,vector does in dev.
vi.hoisted(() => {
  process.env.NEXT_PUBLIC_TOPICS = 'matrix,vector';
});

import { CONFIG } from '@/lib/config';
import { newLearnerProfile } from '@/lib/learner/profile';
import { ALL_UNITS, isUnitPassed } from '@/lib/learner/progress';
import type { LearnerProfile, MisconceptionState, SkillState } from '@/lib/learner/types';
import { packOf, unitOf } from '@/lib/topics';
import { badgesOf, type Badge } from './rewards';

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

const withPassed = (profile: LearnerProfile, ids: readonly string[]): LearnerProfile => ({
  ...profile,
  skills: Object.fromEntries(ids.map((id) => [id, passed])),
});

/** The ids of one unit's skills, from whichever pack has the unit. */
const skillsOfUnit = (unit: number): string[] =>
  [...packOf('matrix').skills, ...packOf('vector').skills]
    .filter((skill) => skill.unit === unit)
    .map(({ id }) => id);

describe('badgesOf with vectors switched on (SPEC §11)', () => {
  it('is switched on here', () => {
    expect(CONFIG.topics).toEqual(['matrix', 'vector']);
  });

  it('gives a passed vector unit its badge, after the matrix units, shown as V1', () => {
    const profile = withPassed(newLearnerProfile({ id: 'V-1', units: [...ALL_UNITS] }), [
      ...skillsOfUnit(3),
      ...skillsOfUnit(11),
    ]);
    expect(badgesOf(profile)).toEqual([
      { kind: 'unit', unit: 3 },
      { kind: 'unit', unit: 11 },
    ]);
    expect(unitOf(11).label).toBe('V1');
  });

  it('opens every vector unit for a student whose stored units a trial narrowed', () => {
    const profile = withPassed(newLearnerProfile({ id: 'V-2', units: [4, 3] }), [
      ...skillsOfUnit(15),
      ...skillsOfUnit(4),
      ...skillsOfUnit(12),
      ...skillsOfUnit(1),
    ]);
    // Unit 1 is not open for this student, as before.
    expect(badgesOf(profile).map((badge) => badge.kind === 'unit' && badge.unit)).toEqual([
      4, 12, 15,
    ]);
  });

  it('gives a unit one badge, even a vector unit a trial stored with the matrix units', () => {
    const profile = withPassed(newLearnerProfile({ id: 'V-3', units: [3, 12] }), skillsOfUnit(12));
    expect(badgesOf(profile)).toEqual([{ kind: 'unit', unit: 12 }]);
  });

  /** badgesOf as it was before it walked each topic's units: the stored units, which are matrix units. */
  const badgesBefore = (profile: LearnerProfile): Badge[] => {
    const units = [...profile.student.units]
      .sort((a, b) => a - b)
      .filter((unit) => isUnitPassed(profile, unit))
      .map((unit): Badge => ({ kind: 'unit', unit }));
    const fixedOne = Object.values(profile.misconceptions).some(
      (state) => state?.rewarded === true,
    );
    return fixedOne ? [...units, { kind: 'fixed' }] : units;
  };

  const skillIds = packOf('matrix').skills.map(({ id }) => id);
  const misconceptionIds = packOf('matrix').catalog.map(({ id }) => id);
  const unitIds = [...ALL_UNITS, ...packOf('vector').units.map(({ id }) => id)];
  /**
   * Any profile with no vector attempt: any matrix units stored in any order (or even repeated, or with
   * vector units among them), any skills tried or passed, any misconception fixed.
   */
  const matrixOnly = fc
    .record({
      units: fc.oneof(
        fc.shuffledSubarray([...ALL_UNITS]),
        fc.array(fc.constantFrom(...unitIds), { maxLength: 8 }),
      ),
      tried: fc.subarray(skillIds),
      passedIds: fc.subarray(skillIds),
      caught: fc.subarray(misconceptionIds),
      rewarded: fc.subarray(misconceptionIds),
    })
    .map(({ units, tried, passedIds, caught, rewarded }) => {
      const profile = newLearnerProfile({ id: 'A-1', units });
      for (const id of tried) profile.skills[id] = { ...passed, passed: false };
      for (const id of passedIds) profile.skills[id] = passed;
      for (const id of caught) profile.misconceptions[id] = fix(false);
      for (const id of rewarded) profile.misconceptions[id] = fix(true);
      return profile;
    });

  it('gives a profile with no vector attempt the same badges as before', () => {
    fc.assert(
      fc.property(matrixOnly, (profile) => {
        expect(badgesOf(profile)).toEqual(badgesBefore(profile));
      }),
      { numRuns: 1000 },
    );
  });
});
