import type { Answer, Classification } from '@/lib/core/types';
import {
  conceptScene,
  exampleSeed,
  introScene,
  remediationScene,
  revealScene,
  type SceneSpec,
} from '@/lib/topics/matrix/scenes';
import { SKILLS, skillById, type SkillId } from '@/lib/topics/matrix/skills';
import type { MatrixItem, MisconceptionId } from '@/lib/topics/matrix/types';
import { nextSkill } from './path';
import type { Profile } from './types';

// Phase 3 stand-in for the rules director: which scene plays when. Phase 4 moves this into NextTurn
// (AI_DIRECTOR §2, R1). Clips stay optional everywhere: if one cannot be built, the lesson carries on.

const clipsSeenOf = (profile: Profile): readonly SkillId[] => profile.clipsSeen ?? [];

export interface LeadClip {
  skill: SkillId;
  spec: SceneSpec;
}

/**
 * The clip before the first item of a new skill (SPEC §4): the first one seen in a unit is its intro,
 * the rest are concept scenes. Null when there is nothing to play right now.
 */
export function leadClip(profile: Profile): LeadClip | null {
  if (profile.current) return null;
  const skill = nextSkill(profile);
  if (skill === null) return null;
  if (profile.skills[skill]?.attempts.length) return null;

  const seen = clipsSeenOf(profile);
  if (seen.includes(skill)) return null;

  const { unit } = skillById(skill);
  const seenInUnit = SKILLS.some((other) => other.unit === unit && seen.includes(other.id));
  try {
    const spec = seenInUnit
      ? conceptScene(skill, { seed: exampleSeed(`${profile.student.id}:lead:${skill}`, 0) })
      : introScene(unit);
    return { skill, spec };
  } catch {
    return null;
  }
}

/** Seen or skipped, it does not play again. "ไม่เข้าใจ" can still bring up the concept scene. */
export function markClipSeen(profile: Profile, skill: SkillId): Profile {
  const seen = clipsSeenOf(profile);
  return seen.includes(skill) ? profile : { ...profile, clipsSeen: [...seen, skill] };
}

/**
 * The "ไม่เข้าใจ" button (SPEC §4): the skill's concept scene on a sibling example, a new one on each
 * press, and never this item or its answer. Null only if no example can be built.
 */
export function helpScene(item: MatrixItem, nth: number): SceneSpec | null {
  try {
    return conceptScene(item.ref.skill, {
      seed: exampleSeed(`${item.ref.seed}:help`, nth),
      level: item.ref.difficulty,
      avoid: item,
      purpose: 'request',
    });
  } catch {
    return null;
  }
}

export interface Remediation {
  spec: SceneSpec;
  /** False for worked_solution, which the "ดูวิธีทำ" button already opens. */
  isClip: boolean;
}

/** The scene for a caught misconception (SCENES §3). Phase 4 replaces this with R1. */
export function remediationFor(
  item: MatrixItem,
  answer: Answer,
  classification: Classification,
): Remediation | null {
  if (classification.type !== 'misconception') return null;
  try {
    const spec = remediationScene(item, answer, {
      id: classification.id as MisconceptionId,
      variant: classification.variant,
    });
    return { spec, isClip: spec.template !== 'worked_solution' };
  } catch {
    return null;
  }
}

/** What "ดูวิธีทำ" opens: the misconception's own worked scene when it has one, else the plain one. */
export function workedSceneFor(
  item: MatrixItem,
  answer: Answer,
  classification: Classification,
): SceneSpec {
  const remediation = remediationFor(item, answer, classification);
  return remediation && !remediation.isClip ? remediation.spec : revealScene(item);
}
