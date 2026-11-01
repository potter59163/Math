import type { Level } from '@/lib/core/types';
import type { Skill, SkillId } from '@/lib/topics/matrix/skills';
import type { MatrixItemRef, MisconceptionId } from '@/lib/topics/matrix/types';

export type UnitId = Skill['unit'];

/** How far down the hint ladder a student went on one item. 0 means no hint. */
export type HintLevel = 0 | 1 | 2 | 3;

export interface LocalStudent {
  /** Seeds this student's items through deriveSeed. */
  id: string;
  classCode: string;
  seatNo: number;
  /** Stays on this device. */
  nickname?: string;
  /** Stand-in for settings.unitsEnabled until Phase 5. */
  units: UnitId[];
}

export interface FirstAttempt {
  level: Level;
  /** Correct with at most an L1 hint, which is how the learner model reads it (SPEC §7.1). */
  countsCorrect: boolean;
  /** Correct with no hint at all, which is what passing a skill needs (SPEC §7.1). */
  clean: boolean;
}

export interface SkillProgress {
  level: Level;
  attempts: FirstAttempt[];
  passed: boolean;
}

export interface OpenItem {
  ref: MatrixItemRef;
  hintLevel: HintLevel;
}

export interface Profile {
  student: LocalStudent;
  /** Next value for deriveSeed (SPEC §6). */
  counter: number;
  xp: number;
  combo: number;
  bestCombo: number;
  itemsDone: number;
  skills: Partial<Record<SkillId, SkillProgress>>;
  /** Times each misconception was caught. Phase 4 replaces this with the states of SPEC §7.2. */
  caught: Partial<Record<MisconceptionId, number>>;
  /** Survives a reload, so refreshing never gives new numbers or a second try. */
  current?: OpenItem;
  /** Skills whose lead clip has played or been skipped (SPEC §4). Missing on older saved profiles. */
  clipsSeen?: SkillId[];
}
