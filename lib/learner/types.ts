import type { CONFIG } from '@/lib/config';
import type { Answer, Classification, Level } from '@/lib/core/types';
import type { Skill, SkillId } from '@/lib/topics/matrix/skills';
import type { MatrixItem, MatrixItemRef, MisconceptionId } from '@/lib/topics/matrix/types';

export type LearnerConfig = typeof CONFIG;

export type UnitId = Skill['unit'];

/** How far down the hint ladder a student went on one item. 0 means no hint. */
export type HintLevel = 0 | 1 | 2 | 3;

/** What the real-life examples in a student's lesson clips are about (SCENES §5). */
export type ThemeId = 'shop' | 'game' | 'sport' | 'music' | 'food';

/**
 * Only what the learner model needs. A display name lives in `profiles` and never enters this, so a
 * profile can be read by the LLM's input builder without anything that identifies the student.
 */
export interface Student {
  /** An account id or, for a guest, a random one. Seeds this student's items through deriveSeed. */
  id: string;
  /** All of them unless a trial narrows them. */
  units: UnitId[];
  theme?: ThemeId;
}

/** One day of work, for the streak and the daily goal. `day` is YYYY-MM-DD in Thai time. */
export interface DayActivity {
  day: string;
  items: number;
  xp: number;
}

export interface FirstAttempt {
  /** The level of the item, which a probe or a review can move away from the level of the skill. */
  level: Level;
  /** Correct with at most an L1 hint, which is how the learner model reads it (SPEC §7.1). */
  countsCorrect: boolean;
  /** Correct with no hint at all, which is what passing a skill needs (SPEC §7.1). */
  clean: boolean;
  /** For `attempts.time_ms` (SPEC §13). */
  timeMs: number;
}

export interface SkillState {
  /** P(L) of SPEC §7.1. */
  pKnown: number;
  /** The level of SPEC §7.3. A single easier item never changes it. */
  level: Level;
  attempts: FirstAttempt[];
  /** Latches once reached, so a later skill can never lock again (SPEC §7.1). */
  passed: boolean;
  /** Wrong first attempts in a row, since the last right answer or the last time R7 fired. */
  wrongStreak: number;
  /** R7 fired and no right answer has come since. The teacher's flag in Phase 5 reads this. */
  stuck: boolean;
  /** `itemsDone` when this skill was last answered, for the reviews of SPEC §7.4. */
  lastSeen: number;
  /** Every pre-test item of this skill was right: it starts at L2 and may pass fast (SPEC §7.1). */
  pretestCorrect?: boolean;
}

/** A misconception with no state yet is `none` in SPEC §7.2. */
export type MisconceptionStatus = 'suspected' | 'active' | 'resolved';

export interface MisconceptionState {
  status: MisconceptionStatus;
  /** Times caught, including on the pre-test. */
  count: number;
  /** Right answers in a row on items aimed at this one. */
  fixStreak: number;
  /** The variant caught last, so the next probe can show it (MISCONCEPTIONS §4.1). */
  variant?: string;
  /** Times its scene was played or skipped, which R1 reads. */
  scenesSeen: number;
  /** `itemsDone` when it last opened, whether at the first catch or a relapse. */
  openedAtItem: number;
  openedAtMs: number;
  lastCaughtAtItem: number;
  /** The metrics of SPEC §7.2, from the latest fix. */
  itemsToResolve?: number;
  msToResolve?: number;
  /** Times it came back after being resolved, which the research report counts (RESEARCH §6). */
  relapses?: number;
  /** The +20 XP is paid once, and not again after a relapse. */
  rewarded: boolean;
  fromPretest?: boolean;
}

export interface OpenItem {
  ref: MatrixItemRef;
  hintLevel: HintLevel;
}

export interface LearnerProfile {
  student: Student;
  /** Next value for deriveSeed (SPEC §6). */
  counter: number;
  xp: number;
  combo: number;
  bestCombo: number;
  itemsDone: number;
  skills: Partial<Record<SkillId, SkillState>>;
  misconceptions: Partial<Record<MisconceptionId, MisconceptionState>>;
  /** Survives a reload, so refreshing never gives new numbers or a second try. */
  current?: OpenItem;
  /** Skills whose lead clip has played or been skipped (SPEC §4). */
  clipsSeen: SkillId[];
  /** `itemsDone` when the last review item opened (SPEC §7.4). */
  lastReviewAt: number;
  activity?: DayActivity[];
  /** Fingerprints of the latest items, so a student does not meet the same one twice. */
  recentItems?: string[];
}

export interface AttemptEvent {
  item: MatrixItem;
  answer: Answer;
  hintLevel: HintLevel;
  /** From the item opening to sending. Measured by the caller, since nothing here reads a clock. */
  timeMs: number;
  /** Clock time at sending. */
  at: number;
}

export interface AttemptOutcome {
  classification: Classification;
  /** For the answer itself (SPEC §11). */
  xp: number;
  /** The +20 for fixing a misconception. */
  bonusXp: number;
  skillPassed: SkillId | null;
  unitPassed: UnitId | null;
  allPassed: boolean;
  /** Fixed by this answer. */
  resolved: MisconceptionId | null;
  /** This answer made R7 fire (SPEC §7.5). */
  stuck: boolean;
  /** How the level of the skill moved. */
  levelChange: -1 | 0 | 1;
}

/** What one skill's pre-test items showed (SPEC §7.1). A skill not on the form has no entry. */
export interface PretestResult {
  outcome: 'correct' | 'misconception' | 'other_wrong';
  caught?: { id: MisconceptionId; variant?: string }[];
}
