import { signedInUserId, signInConfigured } from '@/lib/server/auth';
import { createBoardCache } from '@/lib/server/boardCache';
import { database } from '@/lib/server/db';
import { notConfigured, ok, unauthorized } from '@/lib/server/http';
import { createStore } from '@/lib/server/store';
import { rankEntries, weekStartOf } from '@/lib/sync/leaderboard';
import type { BoardScope } from '@/lib/sync/types';

/** The whole of a school fits well inside this, and it is one indexed query. */
const MAX_ROWS = 1000;

/** Shared by every student of this process who asks within a few seconds (lib/server/boardCache.ts). */
const boards = createBoardCache(async (key) => {
  const [weekStart, cohort] = JSON.parse(key) as [string, string | null];
  return createStore(await database()).weeklyLeaderboard(weekStart, MAX_ROWS, cohort ?? undefined);
});

/**
 * This week's board. A student who came in through a class link sees their class unless they ask for
 * everyone (`?scope=all`). The label of the class is compared here and never sent.
 */
export async function GET(request: Request) {
  if (!signInConfigured()) return notConfigured();
  const userId = await signedInUserId();
  if (!userId) return unauthorized();

  const store = createStore(await database());
  const weekStart = weekStartOf(Date.now());
  const [account, cohort] = await Promise.all([store.loadAccount(userId), store.cohortOf(userId)]);
  const scope: BoardScope =
    cohort !== null && new URL(request.url).searchParams.get('scope') !== 'all' ? 'class' : 'all';
  const rows = await boards(
    JSON.stringify([weekStart, scope === 'class' && cohort !== null ? cohort : null]),
  );
  return ok(
    rankEntries(rows, userId, weekStart, !(account?.showOnLeaderboard ?? true), {
      scope,
      hasClass: cohort !== null,
    }),
  );
}
