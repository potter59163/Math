import type { Answer } from '@/lib/core/types';
import { currentItem } from '@/lib/director/items';
import { startSession, submitAttempt, type SubmitResult } from '@/lib/director/rules';
import { finishScene, finishTurn } from '@/lib/director/turn';
import type { ChosenScene, Condition, Profile } from '@/lib/director/types';
import type { HintLevel } from '@/lib/learner/types';
import type { MatrixItem } from '@/lib/topics/matrix/types';

// Walks the session the way /learn/session does, through the same functions and with no screen.

/** Presses on from the feedback and through every clip of the pending turn. */
export function settle(profile: Profile, onScene?: (scene: ChosenScene) => void): Profile {
  let next = profile;
  while (next.pending) {
    const [scene] = next.pending.turn.scenes;
    if (!scene) return finishTurn(next);
    onScene?.(scene);
    next = finishScene(next);
  }
  return next;
}

export interface OpenItem {
  profile: Profile;
  item: MatrixItem;
}

/** Whatever item the student is looking at now, after any clips before it. */
export function openItem(
  profile: Profile,
  condition: Condition = 'adaptive',
  onScene?: (scene: ChosenScene) => void,
): OpenItem {
  const settled = settle(startSession(settle(profile, onScene), condition), onScene);
  const item = currentItem(settled);
  if (!item) throw new Error('openItem: nothing is open');
  return { profile: settled, item };
}

export interface AnswerOptions {
  condition?: Condition;
  hintLevel?: HintLevel;
  at?: number;
  timeMs?: number;
}

export function answerItem(
  profile: Profile,
  item: MatrixItem,
  answer: Answer,
  { condition = 'adaptive', hintLevel, at = 0, timeMs = 60_000 }: AnswerOptions = {},
): SubmitResult {
  return submitAttempt(
    profile,
    { item, answer, hintLevel: hintLevel ?? profile.current?.hintLevel ?? 0, at, timeMs },
    condition,
  );
}
