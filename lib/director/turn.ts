import { markClipSeen, newLearnerProfile, noteSceneSeen } from '@/lib/learner/profile';
import type { HintLevel, Student } from '@/lib/learner/types';
import { drawItem, fingerprintOf, RECENT_ITEMS } from './items';
import { pathStepFor } from './pathStep';
import type {
  Candidate,
  CandidateId,
  ChosenScene,
  ClosedAttempt,
  FallbackReason,
  NextTurn,
  Profile,
  Trigger,
  TurnMode,
} from './types';

/** The strip shows far fewer than this. The newest stay. */
const MAX_PATH_STEPS = 200;

export function newProfile(student: Student): Profile {
  return { ...newLearnerProfile(student), path: [] };
}

export interface TurnInput {
  trigger: Trigger;
  mode?: TurnMode;
  candidates: Candidate[];
  /** Rules take the top one. The LLM passes its own pick here. */
  choice: CandidateId;
  closed?: ClosedAttempt;
  stuck?: boolean;
  tutor?: TutorWords;
}

/** What the tutor adds to a decision: words only, never another step or another number. */
export interface TutorWords {
  message?: string;
  /** Replaces the captions of the chosen clip, beat by beat. */
  narration?: Partial<Record<string, string>>;
  /** Replaces the rule's reason, for the log. */
  reason?: string;
  latencyMs?: number;
  fallbackReason?: FallbackReason;
}

/**
 * Applies a decision. This is the one place a seed is spent, so the numbers a student gets do not
 * depend on the candidates that were passed over.
 */
export function commitTurn(
  profile: Profile,
  { trigger, mode = 'rules', candidates, choice, closed, stuck = false, tutor }: TurnInput,
): { profile: Profile; turn: NextTurn } {
  const chosen = candidates.find(({ id }) => id === choice) ?? candidates[0];
  const resumes = chosen.next.purpose === 'resume';
  const draw = resumes ? null : drawItem(profile, chosen.next);
  const pathStep = pathStepFor(
    draw?.fellBack ? { ...chosen, stepKind: 'same_level', misconception: undefined } : chosen,
    draw?.item.ref.difficulty ?? chosen.next.level,
  );
  const firstScene = chosen.scene && {
    ...chosen.scene,
    ...(tutor?.narration && { narration: tutor.narration }),
  };
  const scenes = [firstScene, chosen.thenScene].filter(
    (scene): scene is ChosenScene => scene !== undefined,
  );
  const turn: NextTurn = {
    trigger,
    mode,
    revealAllowed: trigger === 'after_attempt',
    candidates,
    choice: chosen.id,
    reason: tutor?.reason ?? chosen.ruleReason,
    scenes,
    next: draw?.item.ref ?? null,
    pathStep,
    stuck,
    ...(draw?.fellBack && { fallback: 'generator' as const }),
    ...(tutor?.message && { message: tutor.message }),
    ...(tutor?.latencyMs !== undefined && { latencyMs: tutor.latencyMs }),
    ...(tutor?.fallbackReason && { fallbackReason: tutor.fallbackReason }),
  };

  const issued = draw && {
    counter: draw.counter,
    recentItems: [...(profile.recentItems ?? []), fingerprintOf(draw.item)].slice(-RECENT_ITEMS),
    current: { ref: draw.item.ref, hintLevel: (chosen.next.hintLevel ?? 0) as HintLevel },
    lastReviewAt: chosen.next.purpose === 'review' ? profile.itemsDone : profile.lastReviewAt,
    pending: closed || scenes.length > 0 ? { turn, ...(closed && { closed }) } : undefined,
  };
  return {
    turn,
    profile: { ...profile, ...issued, path: [...profile.path, pathStep].slice(-MAX_PATH_STEPS) },
  };
}

function noteScene(profile: Profile, { request }: ChosenScene): Profile {
  switch (request.kind) {
    case 'intro':
      return markClipSeen(profile, request.skill);
    case 'concept':
      return request.purpose === 'concept' ? markClipSeen(profile, request.skill) : profile;
    case 'remediate':
      return noteSceneSeen(profile, request.caught.id);
    case 'reveal':
      return profile;
  }
}

/** A clip of the pending turn closed, watched or skipped. The item opens once none are left. */
export function finishScene(profile: Profile): Profile {
  const { pending } = profile;
  if (!pending) return profile;
  const [played, ...rest] = pending.turn.scenes;
  const noted = played ? noteScene(profile, played) : profile;
  return {
    ...noted,
    pending: rest.length > 0 ? { turn: { ...pending.turn, scenes: rest } } : undefined,
  };
}

/** The student pressed on from the feedback, with no clip to play. */
export function finishTurn(profile: Profile): Profile {
  return profile.pending ? { ...profile, pending: undefined } : profile;
}

/** "ดูวิธีทำ" showed a misconception's own scene, which counts for R1 like any other view. */
export function noteWorkedView(profile: Profile, request: ChosenScene['request']): Profile {
  return request.kind === 'remediate' ? noteSceneSeen(profile, request.caught.id) : profile;
}
