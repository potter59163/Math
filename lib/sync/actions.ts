import { restoreAnswer, type StoredAnswer } from '@/lib/core/answerJson';
import { rebuildItem } from '@/lib/director/items';
import { beginSession, practiceSkill, requestHelp, submitAttempt } from '@/lib/director/rules';
import { finishScene, finishTurn, noteWorkedView } from '@/lib/director/turn';
import type { Condition, NextTurn, Profile, SceneRequest } from '@/lib/director/types';
import { advanceHint } from '@/lib/learner/profile';
import type { AttemptEvent, AttemptOutcome, HintLevel, ThemeId } from '@/lib/learner/types';
import type { ScenePurpose, TemplateId } from '@/lib/topics/matrix/scenes';
import type { SkillId } from '@/lib/topics/matrix/skills';
import type { MatrixItemRef } from '@/lib/topics/matrix/types';

// Everything a student does that changes their profile, as data. The browser applies an action at once
// and the server applies the same one to its own copy, through the same pure code. So feedback never
// waits for the network, a lost connection loses nothing, and the server still does its own counting.

export interface SceneViewLog {
  template: TemplateId;
  purpose: ScenePurpose;
  beatsTotal: number;
  beatsSeen: number;
  replays: number;
  skipped: boolean;
  durationMs: number;
}

export type LearnerAction =
  | { type: 'start' }
  | { type: 'practice'; skill: SkillId }
  | { type: 'hint' }
  | {
      type: 'attempt';
      ref: MatrixItemRef;
      answer: StoredAnswer;
      hintLevel: HintLevel;
      timeMs: number;
      at: number;
    }
  | { type: 'help'; ref: MatrixItemRef; nth: number }
  | { type: 'finish_scene' }
  | { type: 'finish_turn' }
  | { type: 'note_worked'; request: SceneRequest }
  | { type: 'scene_view'; view: SceneViewLog }
  | { type: 'set_theme'; theme: ThemeId };

export interface ActionResult {
  profile: Profile;
  /** The decision this action led to, if it led to one. */
  turn?: NextTurn;
  outcome?: AttemptOutcome;
}

/** Null when the ref or the answer cannot be rebuilt, which only an old or a forged action can cause. */
export function attemptEvent(
  action: Extract<LearnerAction, { type: 'attempt' }>,
): AttemptEvent | null {
  const item = rebuildItem(action.ref);
  if (!item) return null;
  try {
    return {
      item,
      answer: restoreAnswer(action.answer),
      hintLevel: action.hintLevel,
      timeMs: action.timeMs,
      at: action.at,
    };
  } catch {
    return null;
  }
}

/** Pure. An action that makes no sense in this state changes nothing rather than throwing. */
export function applyAction(
  profile: Profile,
  action: LearnerAction,
  condition: Condition = 'adaptive',
): ActionResult {
  switch (action.type) {
    case 'start': {
      const started = beginSession(profile, condition);
      return { profile: started.profile, ...(started.turn && { turn: started.turn }) };
    }
    case 'practice':
      return practiceSkill(profile, action.skill) ?? { profile };
    case 'hint':
      return { profile: advanceHint(profile) };
    case 'attempt': {
      const event = attemptEvent(action);
      return event ? submitAttempt(profile, event, condition) : { profile };
    }
    case 'help': {
      const item = rebuildItem(action.ref);
      return (item && requestHelp(profile, item, action.nth)) ?? { profile };
    }
    case 'finish_scene':
      return { profile: finishScene(profile) };
    case 'finish_turn':
      return { profile: finishTurn(profile) };
    case 'note_worked':
      return { profile: noteWorkedView(profile, action.request) };
    case 'scene_view':
      return { profile };
    case 'set_theme':
      return { profile: { ...profile, student: { ...profile.student, theme: action.theme } } };
  }
}
