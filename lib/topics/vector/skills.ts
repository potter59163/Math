import { thVector, type VectorUnitId } from '@/lib/content/th.vector';
import type { Level } from '@/lib/core/types';

/** Prefixed v_ so they never clash with matrix skills in one flat profile (docs/VECTORS.md §2). */
export type SkillId =
  | 'v_quantity'
  | 'v_geom'
  | 'v_points'
  | 'v_linear'
  | 'v_parallel'
  | 'v_magnitude'
  | 'v_unit'
  | 'v_dot'
  | 'v_angle'
  | 'v_perp'
  | 'v_cross'
  | 'v_area'
  | 'v_volume';

export interface Skill {
  id: SkillId;
  /** 11–15 inside the app, shown as V1–V5 (docs/VECTORS.md §6.1). */
  unit: VectorUnitId;
  nameTh: string;
  prereq: SkillId[];
  /** Highest level with a generator. */
  maxLevel: Level;
}

function skill(id: SkillId, unit: Skill['unit'], prereq: SkillId[], maxLevel: Level = 3): Skill {
  return { id, unit, nameTh: thVector.skills[id], prereq, maxLevel };
}

/** docs/VECTORS.md §2, in teaching order. */
export const SKILLS: Skill[] = [
  skill('v_quantity', 11, []),
  skill('v_geom', 11, ['v_quantity']),
  skill('v_points', 12, ['v_quantity']),
  skill('v_linear', 12, ['v_points', 'v_geom']),
  skill('v_parallel', 12, ['v_linear']),
  skill('v_magnitude', 13, ['v_points']),
  skill('v_unit', 13, ['v_magnitude', 'v_linear']),
  skill('v_dot', 14, ['v_linear']),
  skill('v_angle', 14, ['v_dot', 'v_magnitude']),
  skill('v_perp', 14, ['v_dot']),
  skill('v_cross', 15, ['v_dot']),
  skill('v_area', 15, ['v_cross', 'v_magnitude']),
  // L3 ("find a variable from a given volume") is ☆.
  skill('v_volume', 15, ['v_cross', 'v_dot'], 2),
];

export const UNITS: VectorUnitId[] = [11, 12, 13, 14, 15];

export function skillById(id: SkillId): Skill {
  const found = SKILLS.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`skillById: unknown skill ${id}`);
  return found;
}

export function levelsOf(id: SkillId): Level[] {
  return ([1, 2, 3] as const).filter((level) => level <= skillById(id).maxLevel);
}
