import type { AvatarId, BoardScope, LeaderboardEntry, LeaderboardResponse } from './types';

// The weekly board. A new week starts on Monday at midnight in Thailand, so nobody stays out of reach
// for long, and a student who just started can still get on it.

const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * How far down the board is shown. Whoever is below it sees their own place with the one above and the
 * one below, instead of the whole class above them (Potter's choice, 25 Nov 2026).
 */
export const SHOWN_ON_BOARD = 10;

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
  /** The key of the photo this student chose to show on the board, if they did. */
  photo?: string;
}

/** Ties share a rank. No user id leaves this function: `isMe` is all the browser learns. */
export function rankEntries(
  rows: readonly BoardRow[],
  userId: string,
  weekStart: string,
  hidden: boolean,
  board: { scope: BoardScope; hasClass: boolean } = { scope: 'all', hasClass: false },
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
      ...(row.photo && { photo: row.photo }),
    };
  });
  const mine = entries.findIndex(({ isMe }) => isMe);
  return {
    weekStart,
    ...board,
    entries: entries.slice(0, SHOWN_ON_BOARD),
    // Below the top: this student with the place just above and just below, none of it repeated.
    around:
      mine >= SHOWN_ON_BOARD ? entries.slice(Math.max(SHOWN_ON_BOARD, mine - 1), mine + 2) : [],
    me: mine >= 0 ? entries[mine] : null,
    hidden,
  };
}
