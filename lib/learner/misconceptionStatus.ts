import { CONFIG } from '@/lib/config';
import type { LearnerConfig, MisconceptionState, MisconceptionStatus } from './types';

// The state machine of SPEC §7.2, one misconception at a time. No state at all means `none`.

interface When {
  /** `itemsDone` after this item. */
  itemNo: number;
  /** Clock time, passed in. */
  at: number;
}

export function isOpen(state: MisconceptionState | undefined): boolean {
  return state?.status === 'suspected' || state?.status === 'active';
}

export function onCaught(
  state: MisconceptionState | undefined,
  { itemNo, at, variant }: When & { variant?: string },
  config: LearnerConfig = CONFIG,
): MisconceptionState {
  if (!state) {
    return {
      status: 'suspected',
      count: 1,
      fixStreak: 0,
      ...(variant !== undefined && { variant }),
      scenesSeen: 0,
      openedAtItem: itemNo,
      openedAtMs: at,
      lastCaughtAtItem: itemNo,
      rewarded: false,
    };
  }
  const relapse = state.status === 'resolved';
  const count = state.count + 1;
  return {
    ...state,
    status: relapse || count >= config.misconception.activeAtCount ? 'active' : state.status,
    count,
    fixStreak: 0,
    ...(variant !== undefined && { variant }),
    lastCaughtAtItem: itemNo,
    ...(relapse && {
      openedAtItem: itemNo,
      openedAtMs: at,
      relapses: (state.relapses ?? 0) + 1,
    }),
  };
}

/**
 * An answer to an item aimed at this misconception. `counts` means right on the first attempt with at
 * most an L1 hint. Items not aimed at it never come here, so they cannot break the streak.
 */
export function onTargetedAnswer(
  state: MisconceptionState,
  counts: boolean,
  { itemNo, at }: When,
  config: LearnerConfig = CONFIG,
): { state: MisconceptionState; resolved: boolean } {
  if (!isOpen(state)) return { state, resolved: false };
  if (!counts) return { state: { ...state, fixStreak: 0 }, resolved: false };

  const fixStreak = state.fixStreak + 1;
  if (fixStreak < config.misconception.resolveAfterTargetedCorrect) {
    return { state: { ...state, fixStreak }, resolved: false };
  }
  return {
    state: {
      ...state,
      status: 'resolved',
      fixStreak: 0,
      itemsToResolve: itemNo - state.openedAtItem,
      msToResolve: at - state.openedAtMs,
    },
    resolved: true,
  };
}

type StatusOrNone = MisconceptionStatus | undefined;

const LEGAL_CHANGES: readonly [StatusOrNone, StatusOrNone][] = [
  [undefined, 'suspected'],
  ['suspected', 'active'],
  ['suspected', 'resolved'],
  ['active', 'resolved'],
  ['resolved', 'active'],
];

/** For the simulated learners: anything else is an illegal transition. */
export function isLegalStatusChange(from: StatusOrNone, to: StatusOrNone): boolean {
  return from === to || LEGAL_CHANGES.some(([a, b]) => a === from && b === to);
}
