import { storeAnswer } from '@/lib/core/answerJson';
import { applyAttempt, openMisconceptions } from '@/lib/learner/profile';
import type { AttemptEvent, AttemptOutcome } from '@/lib/learner/types';
import type { MatrixItem } from '@/lib/topics/matrix/types';
import { afterAttemptCandidates, requestCandidates, sessionStartCandidates } from './candidates';
import { fixedCandidates } from './fixedPath';
import { currentItem } from './items';
import { commitTurn } from './turn';
import type { Candidate, Condition, NextTurn, Profile, TurnMode } from './types';

// The rules director: the top-scored candidate wins (AI_DIRECTOR §1). This is what runs with
// LLM_PROVIDER=none, and what any LLM failure falls back to.

export function chooseByRules(candidates: Candidate[]): Candidate {
  return candidates[0];
}

const modeOf = (condition: Condition): TurnMode => (condition === 'fixed' ? 'fixed' : 'rules');

/**
 * session_start. An item already open or a turn not finished carries on, with no new decision, so a
 * reload changes nothing. The turn is what /api/session/start sends back.
 */
export function beginSession(
  profile: Profile,
  condition: Condition = 'adaptive',
): { profile: Profile; turn: NextTurn | null } {
  if (profile.pending || currentItem(profile)) return { profile, turn: null };
  const candidates =
    condition === 'fixed' ? fixedCandidates(profile) : sessionStartCandidates(profile);
  return commitTurn(profile, {
    trigger: 'session_start',
    mode: modeOf(condition),
    candidates,
    choice: chooseByRules(candidates).id,
  });
}

export function startSession(profile: Profile, condition: Condition = 'adaptive'): Profile {
  return beginSession(profile, condition).profile;
}

export interface SubmitResult {
  profile: Profile;
  outcome: AttemptOutcome;
  turn: NextTurn;
}

/** The whole of after_attempt: learner model, candidates, decision. */
export function submitAttempt(
  profile: Profile,
  event: AttemptEvent,
  condition: Condition = 'adaptive',
): SubmitResult {
  const { profile: after, outcome } = applyAttempt(profile, event);
  const attempt = { item: event.item, answer: event.answer, outcome };
  const candidates =
    condition === 'fixed'
      ? fixedCandidates(after, attempt)
      : afterAttemptCandidates(after, attempt);
  const committed = commitTurn(after, {
    trigger: 'after_attempt',
    mode: modeOf(condition),
    candidates,
    choice: chooseByRules(candidates).id,
    stuck: outcome.stuck,
    closed: {
      ref: event.item.ref,
      answer: storeAnswer(event.answer),
      outcome,
      hintLevel: event.hintLevel,
      openAtSend: openMisconceptions(profile),
    },
  });
  return { ...committed, outcome };
}

/** student_request: "ไม่เข้าใจ". The item stays open, and null means no clip could be built. */
export function requestHelp(
  profile: Profile,
  item: MatrixItem,
  nth: number,
): { profile: Profile; turn: NextTurn } | null {
  const candidates = requestCandidates(item, nth);
  if (candidates.length === 0) return null;
  return commitTurn(profile, {
    trigger: 'student_request',
    candidates,
    choice: chooseByRules(candidates).id,
  });
}
