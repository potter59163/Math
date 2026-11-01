import { CONFIG } from '@/lib/config';
import { startSession } from '@/lib/director/rules';
import { newProfile } from '@/lib/director/turn';
import type { ChosenScene, Condition, NextTurn, Profile } from '@/lib/director/types';
import { applyPretest } from '@/lib/learner/profile';
import { isUnlocked } from '@/lib/learner/progress';
import type { AttemptOutcome, PretestResult, UnitId } from '@/lib/learner/types';
import type { SkillId } from '@/lib/topics/matrix/skills';
import type { MatrixItemRef } from '@/lib/topics/matrix/types';
import { answerItem, openItem } from './drive';
import { checkStep, checkTurn, type Violation } from './invariants';
import type { SimStudent } from './students';

/** RESEARCH §3.1 assumes one item a minute. */
const SECONDS_PER_ITEM = 60;

export interface SimOptions {
  id: string;
  student: SimStudent;
  units: UnitId[];
  condition?: Condition;
  /** Stops after this many items. */
  items?: number;
  /** Stops once this much planned time has gone (RESEARCH §3.1). */
  minutes?: number;
  pretest?: Partial<Record<SkillId, PretestResult>>;
}

export interface SimStep {
  ref: MatrixItemRef;
  outcome: AttemptOutcome;
  turn: NextTurn;
  /** The item came up in a skill whose prereqs were unfinished. Only the fixed path can do this. */
  skippedPrereq: boolean;
  /** Planned time used once this item was answered. */
  minutes: number;
}

export interface SimRun {
  profile: Profile;
  steps: SimStep[];
  scenes: ChosenScene[];
  violations: Violation[];
  /** Planned time, not a stopwatch: one minute an item, and each clip at its limit. */
  minutes: number;
}

function plannedSeconds({ request }: ChosenScene): number {
  const { limitMs } = CONFIG.scenes;
  switch (request.kind) {
    case 'intro':
      return limitMs.intro / 1000;
    case 'concept':
      return limitMs.concept / 1000;
    case 'remediate':
      return limitMs.remediate / 1000;
    case 'reveal':
      return limitMs.reveal / 1000;
  }
}

/** One student through the same functions the session screen calls, with every transition checked. */
export function runStudent({
  id,
  student,
  units,
  condition = 'adaptive',
  items = Infinity,
  minutes = Infinity,
  pretest,
}: SimOptions): SimRun {
  const fresh = newProfile({ id, units });
  const start = pretest ? applyPretest(fresh, pretest, { at: 0 }) : fresh;

  const steps: SimStep[] = [];
  const scenes: ChosenScene[] = [];
  const violations: Violation[] = [];
  let seconds = 0;
  const onScene = (scene: ChosenScene) => {
    scenes.push(scene);
    seconds += plannedSeconds(scene);
    student.onScene(scene);
  };

  let profile = startSession(start, condition);
  if (profile.pending) violations.push(...checkTurn(profile, profile.pending.turn));

  while (steps.length < items && seconds < minutes * 60) {
    const opened = openItem(profile, condition, onScene);
    const answer = student.answer(opened.item);
    const result = answerItem(opened.profile, opened.item, answer, {
      condition,
      at: seconds * 1000,
      timeMs: SECONDS_PER_ITEM * 1000,
    });
    seconds += SECONDS_PER_ITEM;
    violations.push(...checkStep(opened.profile, result.profile));
    violations.push(...checkTurn(result.profile, result.turn));
    steps.push({
      ref: opened.item.ref,
      outcome: result.outcome,
      turn: result.turn,
      skippedPrereq: !isUnlocked(opened.profile, opened.item.ref.skill),
      minutes: seconds / 60,
    });
    profile = result.profile;
  }
  return { profile, steps, scenes, violations, minutes: seconds / 60 };
}
