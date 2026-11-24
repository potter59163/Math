import {
  activeTopicOf,
  DEFAULT_TOPIC,
  packOf,
  packOfSkill,
  packOfUnit,
  skillOf,
} from '@/lib/topics';
import type { SkillId, TopicId } from '@/lib/topics/types';
import type { LearnerProfile, UnitId } from './types';

/** Every matrix unit, which is what `student.units` holds for a new student. */
export const ALL_UNITS: readonly UnitId[] = packOf(DEFAULT_TOPIC).units.map(({ id }) => id);

export type SkillStatus = 'passed' | 'current' | 'open' | 'locked';

export interface UnitOnMap {
  unit: UnitId;
  passed: boolean;
  skills: { id: SkillId; status: SkillStatus }[];
}

type Progress = Pick<LearnerProfile, 'student' | 'skills'>;

/** Each topic's units are open or not by its own pack: stored `student.units` means matrix units. */
export const inOpenUnit = (profile: Pick<LearnerProfile, 'student'>, id: SkillId): boolean =>
  packOfSkill(id).openUnits(profile.student).includes(skillOf(id).unit);

export const hasPassed = (profile: Pick<LearnerProfile, 'skills'>, id: SkillId): boolean =>
  profile.skills[id]?.passed === true;

/** A prereq in a closed unit counts as passed (SPEC §3). Prereqs never leave their own topic. */
export function isUnlocked(profile: Progress, id: SkillId): boolean {
  return skillOf(id).prereq.every(
    (prereq) => !inOpenUnit(profile, prereq) || hasPassed(profile, prereq),
  );
}

/**
 * First skill left in a topic's teaching order, by default the topic the student is learning. A pack
 * lists prereqs first, so it is always unlocked.
 */
export function nextSkill(
  profile: Progress,
  topic: TopicId = activeTopicOf(profile.student),
): SkillId | null {
  const next = packOf(topic).skills.find(
    ({ id }) => inOpenUnit(profile, id) && !hasPassed(profile, id),
  );
  return next?.id ?? null;
}

export function skillStatus(profile: Progress, id: SkillId): SkillStatus {
  if (hasPassed(profile, id)) return 'passed';
  if (nextSkill(profile, packOfSkill(id).id) === id) return 'current';
  return isUnlocked(profile, id) ? 'open' : 'locked';
}

export function isUnitPassed(profile: Progress, unit: UnitId): boolean {
  return packOfUnit(unit)
    .skills.filter((skill) => skill.unit === unit)
    .every(({ id }) => hasPassed(profile, id));
}

/** One topic's open units in order, each with its skills, for the map and the summary. */
export function mapOf(
  profile: Progress,
  topic: TopicId = activeTopicOf(profile.student),
): UnitOnMap[] {
  const pack = packOf(topic);
  return [...pack.openUnits(profile.student)]
    .sort((a, b) => a - b)
    .map((unit) => ({
      unit,
      passed: isUnitPassed(profile, unit),
      skills: pack.skills
        .filter((skill) => skill.unit === unit)
        .map(({ id }) => ({ id, status: skillStatus(profile, id) })),
    }));
}
