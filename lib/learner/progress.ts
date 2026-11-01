import { SKILLS, skillById, type SkillId } from '@/lib/topics/matrix/skills';
import type { LearnerProfile, UnitId } from './types';

export const ALL_UNITS: readonly UnitId[] = [1, 2, 3, 4, 5];

export type SkillStatus = 'passed' | 'current' | 'open' | 'locked';

export interface UnitOnMap {
  unit: UnitId;
  passed: boolean;
  skills: { id: SkillId; status: SkillStatus }[];
}

type Progress = Pick<LearnerProfile, 'student' | 'skills'>;

export const inOpenUnit = (profile: Pick<LearnerProfile, 'student'>, id: SkillId): boolean =>
  profile.student.units.includes(skillById(id).unit);

export const hasPassed = (profile: Pick<LearnerProfile, 'skills'>, id: SkillId): boolean =>
  profile.skills[id]?.passed === true;

/** A prereq in a closed unit counts as passed (SPEC §3). */
export function isUnlocked(profile: Progress, id: SkillId): boolean {
  return skillById(id).prereq.every(
    (prereq) => !inOpenUnit(profile, prereq) || hasPassed(profile, prereq),
  );
}

/** First skill left in teaching order. SKILLS lists prereqs first, so it is always unlocked. */
export function nextSkill(profile: Progress): SkillId | null {
  const next = SKILLS.find(({ id }) => inOpenUnit(profile, id) && !hasPassed(profile, id));
  return next?.id ?? null;
}

export function skillStatus(profile: Progress, id: SkillId): SkillStatus {
  if (hasPassed(profile, id)) return 'passed';
  if (nextSkill(profile) === id) return 'current';
  return isUnlocked(profile, id) ? 'open' : 'locked';
}

export function isUnitPassed(profile: Progress, unit: UnitId): boolean {
  return SKILLS.filter((skill) => skill.unit === unit).every(({ id }) => hasPassed(profile, id));
}

/** The open units in order, each with its skills, for the map and the summary. */
export function mapOf(profile: Progress): UnitOnMap[] {
  return [...profile.student.units]
    .sort((a, b) => a - b)
    .map((unit) => ({
      unit,
      passed: isUnitPassed(profile, unit),
      skills: SKILLS.filter((skill) => skill.unit === unit).map(({ id }) => ({
        id,
        status: skillStatus(profile, id),
      })),
    }));
}
