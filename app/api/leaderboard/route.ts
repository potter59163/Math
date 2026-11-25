import { signedInUserId, signInConfigured } from '@/lib/server/auth';
import { database } from '@/lib/server/db';
import { notConfigured, ok, unauthorized } from '@/lib/server/http';
import { createStore } from '@/lib/server/store';
import { rankEntries, weekStartOf } from '@/lib/sync/leaderboard';
import type { BoardScope } from '@/lib/sync/types';

/** The whole of a school fits well inside this, and it is one indexed query. */
const MAX_ROWS = 1000;

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
  const rows = await store.weeklyLeaderboard(
    weekStart,
    MAX_ROWS,
    scope === 'class' && cohort !== null ? cohort : undefined,
  );
  return ok(
    rankEntries(rows, userId, weekStart, !(account?.showOnLeaderboard ?? true), {
      scope,
      hasClass: cohort !== null,
    }),
  );
}
