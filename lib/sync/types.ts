import type { Condition, NextTurn, Profile } from '@/lib/director/types';
import type { ThemeId } from '@/lib/learner/types';
import type { LearnerAction } from './actions';

// What crosses the wire between the browser and /api. Plain JSON both ways.

export const AVATARS = ['bracket', 'sigma', 'pi', 'delta', 'theta', 'infinity'] as const;
export type AvatarId = (typeof AVATARS)[number];

export const THEMES: readonly ThemeId[] = ['shop', 'game', 'sport', 'music', 'food'];

export const MAX_DISPLAY_NAME = 20;

/** Everything about a student that is theirs to change. Their email is never sent to the browser. */
export interface Account {
  displayName: string;
  avatar: AvatarId;
  showOnLeaderboard: boolean;
  condition: Condition;
}

/** GET /api/me. `configured` is false until Supabase keys are set, when only guest mode can work. */
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

export type AccountUpdate = Partial<Pick<Account, 'displayName' | 'avatar' | 'showOnLeaderboard'>>;

export interface LeaderboardEntry {
  rank: number;
  displayName: string;
  avatar: AvatarId;
  xp: number;
  isMe: boolean;
}

export interface LeaderboardResponse {
  weekStart: string;
  entries: LeaderboardEntry[];
  /** This student's own place when it is below the list, or null if they have no XP this week. */
  me: LeaderboardEntry | null;
  hidden: boolean;
}
