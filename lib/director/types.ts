import type { th } from '@/lib/content/th';
import type { StoredAnswer } from '@/lib/core/answerJson';
import type { Level } from '@/lib/core/types';
import type { AttemptOutcome, HintLevel, LearnerProfile, UnitId } from '@/lib/learner/types';
import type { Caught, TemplateId } from '@/lib/topics/matrix/scenes';
import type { SkillId } from '@/lib/topics/matrix/skills';
import type { MatrixItemRef, MisconceptionId } from '@/lib/topics/matrix/types';

// All of this is plain JSON, so a turn can be saved, logged to `decisions` and sent by /api/attempt.

export type Trigger = 'session_start' | 'after_attempt' | 'student_request';

export type TurnMode = 'rules' | 'fixed';

export type Condition = 'adaptive' | 'fixed';

export type RuleId = 'R1' | 'R2' | 'R3' | 'R4' | 'R5' | 'R6' | 'R7' | 'start' | 'request' | 'fixed';

export type CandidateId = 'c1' | 'c2' | 'c3' | 'c4';

/** `resume` goes back to the item already open, which is what "ไม่เข้าใจ" does. */
export type NextPurpose = 'practice' | 'probe' | 'review' | 'challenge' | 'resume';

/** The item a candidate leads to. It has no seed: a seed is spent only once a candidate is chosen. */
export interface NextStep {
  skill: SkillId;
  level: Level;
  purpose: NextPurpose;
  target?: MisconceptionId;
  targetVariant?: string;
  /** Opens with hint L1 already shown (R2). */
  hintLevel?: 1;
}

/** How to build a scene, so that it can be rebuilt after a reload or on another machine. */
export type SceneRequest =
  | { kind: 'intro'; unit: UnitId; skill: SkillId }
  | {
      kind: 'concept';
      skill: SkillId;
      seed: number;
      level: Level;
      /** The item the example must not give away (SPEC §4). */
      avoid?: MatrixItemRef;
      purpose: 'concept' | 'request';
    }
  | { kind: 'remediate'; ref: MatrixItemRef; answer: StoredAnswer; caught: Caught }
  | { kind: 'reveal'; ref: MatrixItemRef };

export interface ChosenScene {
  request: SceneRequest;
  template: TemplateId;
  /** AI_DIRECTOR §4.1, and what `narration` may name in Phase 6. */
  beats: string[];
}

export type PathKind = keyof typeof th.pathNotes;

export interface PathStep {
  kind: PathKind;
  skill: SkillId;
  level: Level;
  /** Why this step, at most 40 code units and no digits (AI_DIRECTOR §3.2). */
  note: string;
}

export interface Candidate {
  id: CandidateId;
  rule: RuleId;
  score: number;
  scene?: ChosenScene;
  /** A second clip, which only the fixed path can need: a solution, then the next skill's lead clip. */
  thenScene?: ChosenScene;
  next: NextStep;
  /** Why the rules offer this, in Thai for the teacher. It may have digits. */
  ruleReason: string;
  /** Picks the student's `note`, if this candidate is the one chosen. */
  stepKind: PathKind;
  misconception?: MisconceptionId;
}

/** The director's decision. What Phase 5 logs to `decisions` and sends back from /api/attempt. */
export interface NextTurn {
  trigger: Trigger;
  mode: TurnMode;
  /** False until the item is closed: no token may give the answer away (AI_DIRECTOR §2). */
  revealAllowed: boolean;
  candidates: Candidate[];
  choice: CandidateId;
  reason: string;
  /** Played in order before the next item. */
  scenes: ChosenScene[];
  /** Null when the open item carries on. */
  next: MatrixItemRef | null;
  pathStep: PathStep;
  /** R7 fired, so the teacher should be alerted, whichever candidate was chosen. */
  stuck: boolean;
  /** The generator failed and a plain item replaced the one chosen. Phase 5 logs this. */
  fallback?: 'generator';
}

/** The item just answered, kept so that a reload after sending shows the same feedback. */
export interface ClosedAttempt {
  ref: MatrixItemRef;
  answer: StoredAnswer;
  outcome: AttemptOutcome;
  hintLevel: HintLevel;
  /** As they were on sending, so the hint on screen does not change under the feedback. */
  openAtSend: MisconceptionId[];
}

/** A decision the student has not finished with. It survives a reload. */
export interface PendingTurn {
  turn: NextTurn;
  closed?: ClosedAttempt;
}

/** The learner model plus what the director has decided so far. Phase 5 moves these two to the log. */
export interface Profile extends LearnerProfile {
  path: PathStep[];
  pending?: PendingTurn;
}
