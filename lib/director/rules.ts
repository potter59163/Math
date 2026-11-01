import { storeAnswer } from '@/lib/core/answerJson';
import { applyAttempt, openMisconceptions } from '@/lib/learner/profile';
import type { AttemptEvent, AttemptOutcome } from '@/lib/learner/types';
import type { MatrixItem } from '@/lib/topics/matrix/types';
import type { SkillId } from '@/lib/topics/matrix/skills';
import {
  afterAttemptCandidates,
  practiceCandidates,
  requestCandidates,
  sessionStartCandidates,
  type AttemptContext,
} from './candidates';
import { fixedCandidates } from './fixedPath';
import { currentItem } from './items';
import { ruleMessage } from './messages';
import { commitTurn, type TutorWords } from './turn';
import type {
  Candidate,
  CandidateId,
  ClosedAttempt,
  Condition,
  NextTurn,
  Profile,
  TurnMode,
} from './types';

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

/** An attempt counted and its options worked out, with nothing chosen and no seed spent yet. */
export interface PreparedAttempt {
  after: Profile;
  outcome: AttemptOutcome;
  attempt: AttemptContext;
  candidates: Candidate[];
  closed: ClosedAttempt;
  mode: TurnMode;
}

export function prepareAttempt(
  profile: Profile,
  event: AttemptEvent,
  condition: Condition = 'adaptive',
): PreparedAttempt {
  const { profile: after, outcome } = applyAttempt(profile, event);
  const attempt = { item: event.item, answer: event.answer, outcome };
  return {
    after,
    outcome,
    attempt,
    candidates:
      condition === 'fixed'
        ? fixedCandidates(after, attempt)
        : afterAttemptCandidates(after, attempt),
    closed: {
      ref: event.item.ref,
      answer: storeAnswer(event.answer),
      outcome,
      hintLevel: event.hintLevel,
      openAtSend: openMisconceptions(profile),
    },
    mode: modeOf(condition),
  };
}

/** Whatever chooses, rules or the LLM, the decision is applied here. */
export function commitAttempt(
  { after, outcome, attempt, candidates, closed, mode }: PreparedAttempt,
  choice: CandidateId = chooseByRules(candidates).id,
  tutor?: TutorWords,
): SubmitResult {
  const chosen = candidates.find(({ id }) => id === choice) ?? candidates[0];
  // The control group sees no tutor (AI_DIRECTOR §3.1).
  const message =
    tutor?.message ??
    (mode === 'fixed' ? undefined : ruleMessage(after, attempt.item, attempt.answer, outcome, chosen));
  const committed = commitTurn(after, {
    trigger: 'after_attempt',
    mode,
    candidates,
    choice,
    stuck: outcome.stuck,
    closed,
    tutor: { ...tutor, message },
  });
  return { ...committed, outcome };
}

/** The whole of after_attempt: learner model, candidates, decision by the rules. */
export function submitAttempt(
  profile: Profile,
  event: AttemptEvent,
  condition: Condition = 'adaptive',
): SubmitResult {
  return commitAttempt(prepareAttempt(profile, event, condition));
}

/** The student picked a skill on the map. Null when it is still locked. */
export function practiceSkill(
  profile: Profile,
  skill: SkillId,
): { profile: Profile; turn: NextTurn } | null {
  const candidates = practiceCandidates(profile, skill);
  if (candidates.length === 0) return null;
  return commitTurn(profile, {
    trigger: 'student_request',
    candidates,
    choice: chooseByRules(candidates).id,
  });
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
