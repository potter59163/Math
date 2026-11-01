import { fail, notConfigured, ok, unauthorized } from '@/lib/server/http';
import { createStore } from '@/lib/server/store';
import { adminClient, signedInUserId, supabaseConfigured } from '@/lib/server/supabase';
import { rankEntries, weekStartOf } from '@/lib/sync/leaderboard';

/** The whole of a school fits well inside this, and it is one indexed query. */
const MAX_ROWS = 1000;

export async function GET() {
  if (!supabaseConfigured()) return notConfigured();
  const userId = await signedInUserId();
  if (!userId) return unauthorized();

  const client = adminClient();
  const weekStart = weekStartOf(Date.now());
  const { data, error } = await client.rpc('weekly_leaderboard', {
    week_start: weekStart,
    max_rows: MAX_ROWS,
  });
  if (error) return fail(500, 'leaderboard_failed');

  const account = await createStore(client).loadAccount(userId);
  return ok(rankEntries(data ?? [], userId, weekStart, !(account?.showOnLeaderboard ?? true)));
}
