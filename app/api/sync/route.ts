import { llmDecider } from '@/lib/director/llm/decide';
import { fail, notConfigured, ok, readJson, unauthorized } from '@/lib/server/http';
import { syncRequest } from '@/lib/server/schemas';
import { createStore } from '@/lib/server/store';
import { adminClient, signedInUserId, supabaseConfigured } from '@/lib/server/supabase';
import { NoLearnerError, processActions } from '@/lib/server/sync';
import type { QueuedAction } from '@/lib/sync/types';

/** Far more than anyone answers by hand, and a flush after time offline still gets through. */
const MAX_ATTEMPTS_PER_MINUTE = 120;
const MINUTE_MS = 60_000;

export async function POST(request: Request) {
  if (!supabaseConfigured()) return notConfigured();
  const userId = await signedInUserId();
  if (!userId) return unauthorized();

  const parsed = syncRequest.safeParse(await readJson(request));
  if (!parsed.success) return fail(400, 'bad_request');
  const { deviceId, actions } = parsed.data;

  const store = createStore(adminClient());
  const since = new Date(Date.now() - MINUTE_MS).toISOString();
  if ((await store.attemptsSince(userId, since)) > MAX_ATTEMPTS_PER_MINUTE) {
    return fail(429, 'rate_limited');
  }

  try {
    return ok(
      await processActions({
        store,
        userId,
        deviceId,
        actions: actions as QueuedAction[],
        decide: llmDecider({ userId, store }),
      }),
    );
  } catch (error) {
    if (error instanceof NoLearnerError) return fail(409, 'needs_welcome');
    throw error;
  }
}
