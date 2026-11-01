import type { AvatarId, LeaderboardEntry, LeaderboardResponse } from './types';

// The weekly board. A new week starts on Monday at midnight in Thailand, so nobody stays out of reach
// for long, and a student who just started can still get on it.

const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** How far down the board is shown. Whoever is below it still sees their own place. */
export const SHOWN_ON_BOARD = 50;

export function weekStartOf(now: number): string {
  const local = new Date(now + BANGKOK_OFFSET_MS);
  const daysSinceMonday = (local.getUTCDay() + 6) % 7;
  const midnight = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
  return new Date(midnight - daysSinceMonday * DAY_MS - BANGKOK_OFFSET_MS).toISOString();
}

export interface BoardRow {
  user_id: string;
  display_name: string;
  avatar: string;
  xp: number;
}

/** Ties share a rank. No user id leaves this function: `isMe` is all the browser learns. */
export function rankEntries(
  rows: readonly BoardRow[],
  userId: string,
  weekStart: string,
  hidden: boolean,
): LeaderboardResponse {
  let rank = 0;
  let lastXp = Number.POSITIVE_INFINITY;
  const entries: LeaderboardEntry[] = rows.map((row, index) => {
    if (row.xp < lastXp) {
      rank = index + 1;
      lastXp = row.xp;
    }
    return {
      rank,
      displayName: row.display_name,
      avatar: row.avatar as AvatarId,
      xp: row.xp,
      isMe: row.user_id === userId,
    };
  });
  return {
    weekStart,
    entries: entries.slice(0, SHOWN_ON_BOARD),
    me: entries.find(({ isMe }) => isMe) ?? null,
    hidden,
  };
}
