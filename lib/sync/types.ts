import type { Condition, NextTurn, Profile } from '@/lib/director/types';
import type { ThemeId } from '@/lib/learner/types';
import type { LearnerAction } from './actions';

// What crosses the wire between the browser and /api. Plain JSON both ways.

export const AVATARS = ['bracket', 'sigma', 'pi', 'delta', 'theta', 'infinity'] as const;
export type AvatarId = (typeof AVATARS)[number];

export const THEMES: readonly ThemeId[] = ['shop', 'game', 'sport', 'music', 'food'];

export const MAX_DISPLAY_NAME = 20;

export const MAX_COHORT = 32;
/** A trial's label is compared and never shown, so it refuses only what could not be stored. */
export const COHORT_PATTERN = /^\P{Cc}*$/u;

/** What a link's ?cohort= gives. A label that cannot be kept is dropped: the student is just not grouped. */
export function cohortFromLink(raw: string | null): string | null {
  const cohort = raw?.trim();
  return cohort && cohort.length <= MAX_COHORT && COHORT_PATTERN.test(cohort) ? cohort : null;
}

/** Everything about a student that is theirs to change. Their email is never sent to the browser. */
export interface Account {
  displayName: string;
  avatar: AvatarId;
  showOnLeaderboard: boolean;
  condition: Condition;
  /** When the student last set their own photo. None means the symbol. */
  photoAt?: string;
  /**
   * The student switched on showing that photo beside their name on the leaderboard (Potter, 27 Nov
   * 2026). Absent means off, which is how every photo starts: then only they see it.
   */
  showPhoto?: boolean;
  /**
   * Enough students reported the photo they have now, so it is off the leaderboard until they change
   * it. Said to its owner alone, and neither who reported nor how many is ever said.
   */
  photoReported?: boolean;
  /** Their photos were taken down more than once, so none is shown on the leaderboard any more. */
  photoLocked?: boolean;
}

/** GET /api/me. `configured` is false until the server's keys are set, when only guest mode can work. */
export interface MeResponse {
  configured: boolean;
  /** The tutor is switched on, so a decision may be worth a moment's wait. */
  llm: boolean;
  userId: string | null;
  /** Null until the welcome screen has been finished. */
  account: Account | null;
  profile: Profile | null;
  /** The last action already applied from this device. */
  lastSeq: number;
}

export interface QueuedAction {
  seq: number;
  action: LearnerAction;
}

export interface SyncRequest {
  deviceId: string;
  actions: QueuedAction[];
}

export interface SyncResponse {
  lastSeq: number;
  profile: Profile;
  /** The decision on the batch's last attempt, if it had one. */
  turn: NextTurn | null;
}

export interface WelcomeRequest {
  displayName: string;
  avatar: AvatarId;
  theme: ThemeId;
  consent: true;
  /** From a trial's link. */
  cohort?: string;
  /** Progress made as a guest on this device, carried over once. */
  guestProfile?: Profile;
}

export type AccountUpdate = Partial<
  Pick<Account, 'displayName' | 'avatar' | 'showOnLeaderboard' | 'showPhoto'>
>;

export interface LeaderboardEntry {
  rank: number;
  displayName: string;
  avatar: AvatarId;
  xp: number;
  isMe: boolean;
  /**
   * The key of this student's photo, when they chose to show it here: `/api/photo/<key>`. It is random
   * and changes with the picture, so it is not a way to tell who someone is.
   */
  photo?: string;
}

/** A board of the student's own class (their `?cohort=` link), or of everyone. */
export type BoardScope = 'class' | 'all';

export interface LeaderboardResponse {
  weekStart: string;
  scope: BoardScope;
  /** The student came in through a class link, so a class board exists. Its label never leaves the server. */
  hasClass: boolean;
  /** The top of the board. */
  entries: LeaderboardEntry[];
  /** This student's place and the ones just above and below it, when it is below the top. */
  around: LeaderboardEntry[];
  /** This student's own place, or null if they have no XP this week. */
  me: LeaderboardEntry | null;
  hidden: boolean;
}
