import { accountUpdate } from '@/lib/server/schemas';
import { fail, notConfigured, ok, readJson, unauthorized } from '@/lib/server/http';
import { createStore } from '@/lib/server/store';
import { adminClient, signedInUserId, supabaseConfigured } from '@/lib/server/supabase';
import { llmEnabled } from '@/lib/director/llm/config';
import type { MeResponse } from '@/lib/sync/types';

/** Who is signed in and everything the app needs to start. Works, and says so, with no keys set. */
export async function GET(request: Request) {
  const empty: MeResponse = {
    configured: supabaseConfigured(),
    llm: llmEnabled(),
    userId: null,
    account: null,
    profile: null,
    lastSeq: 0,
  };
  if (!empty.configured) return ok(empty);

  const userId = await signedInUserId();
  if (!userId) return ok(empty);

  const store = createStore(adminClient());
  const [account, learner] = await Promise.all([
    store.loadAccount(userId),
    store.loadLearner(userId),
  ]);
  const device = new URL(request.url).searchParams.get('device') ?? '';
  return ok<MeResponse>({
    ...empty,
    userId,
    account,
    profile: learner?.profile ?? null,
    lastSeq: learner?.devices[device] ?? 0,
  });
}

export async function PATCH(request: Request) {
  if (!supabaseConfigured()) return notConfigured();
  const userId = await signedInUserId();
  if (!userId) return unauthorized();

  const parsed = accountUpdate.safeParse(await readJson(request));
  if (!parsed.success) return fail(400, 'bad_request');

  const store = createStore(adminClient());
  await store.updateAccount(userId, parsed.data);
  return ok({ account: await store.loadAccount(userId) });
}

/** Removes the account and every row about this student, at their own request (SPEC §15). */
export async function DELETE() {
  if (!supabaseConfigured()) return notConfigured();
  const userId = await signedInUserId();
  if (!userId) return unauthorized();

  await createStore(adminClient()).deleteAccount(userId);
  return ok({ deleted: true });
}
