import { signedInUserId, signInConfigured } from '@/lib/server/auth';
import { database } from '@/lib/server/db';
import { notConfigured, ok, unauthorized } from '@/lib/server/http';
import { createStore } from '@/lib/server/store';
import { rankEntries, weekStartOf } from '@/lib/sync/leaderboard';

/** The whole of a school fits well inside this, and it is one indexed query. */
const MAX_ROWS = 1000;

export async function GET() {
  if (!signInConfigured()) return notConfigured();
  const userId = await signedInUserId();
  if (!userId) return unauthorized();

  const store = createStore(await database());
  const weekStart = weekStartOf(Date.now());
  const [rows, account] = await Promise.all([
    store.weeklyLeaderboard(weekStart, MAX_ROWS),
    store.loadAccount(userId),
  ]);
  return ok(rankEntries(rows, userId, weekStart, !(account?.showOnLeaderboard ?? true)));
}
