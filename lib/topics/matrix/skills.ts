import { th } from '@/lib/content/th';
import type { Level } from '@/lib/core/types';

export type SkillId =
  | 'dim'
  | 'index'
  | 'transpose'
  | 'addsub'
  | 'scalar'
  | 'mult_defined'
  | 'mult'
  | 'mult_noncomm'
  | 'det2'
  | 'det3'
  | 'det_props'
  | 'invertible'
  | 'inv2';

export interface Skill {
  id: SkillId;
  unit: 1 | 2 | 3 | 4 | 5;
  nameTh: string;
  prereq: SkillId[];
  /** Highest level with a generator. SPEC §7.3 caps skills that have no L3 in the MVP at 2. */
  maxLevel: Level;
}

function skill(id: SkillId, unit: Skill['unit'], prereq: SkillId[], maxLevel: Level = 3): Skill {
  return { id, unit, nameTh: th.skills[id], prereq, maxLevel };
}

/** SPEC §3, in teaching order. */
export const SKILLS: Skill[] = [
  skill('dim', 1, []),
  skill('index', 1, ['dim']),
  skill('transpose', 1, ['index']),
  skill('addsub', 2, ['dim']),
  skill('scalar', 2, ['addsub']),
  skill('mult_defined', 3, ['dim']),
  skill('mult', 3, ['mult_defined']),
  skill('mult_noncomm', 3, ['mult']),
  // L3 ("find x so that det = 0") is ☆.
  skill('det2', 4, ['dim'], 2),
  skill('det3', 4, ['det2']),
  skill('det_props', 4, ['det3', 'scalar', 'mult']),
  skill('invertible', 5, ['det2']),
  skill('inv2', 5, ['invertible', 'scalar']),
];

export function skillById(id: SkillId): Skill {
  const found = SKILLS.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`skillById: unknown skill ${id}`);
  return found;
}

export function levelsOf(id: SkillId): Level[] {
  return ([1, 2, 3] as const).filter((level) => level <= skillById(id).maxLevel);
}
