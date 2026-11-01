import type { ThemeId } from '@/lib/learner/types';
import { startingProfile } from '@/lib/server/account';
import { signedInUserId, signInConfigured } from '@/lib/server/auth';
import { database } from '@/lib/server/db';
import { fail, notConfigured, ok, readJson, unauthorized } from '@/lib/server/http';
import { welcomeRequest } from '@/lib/server/schemas';
import { createStore } from '@/lib/server/store';
import type { Account, AvatarId } from '@/lib/sync/types';

/** The first sign-in: records consent and the name this student chose (SPEC §4, §15). */
export async function POST(request: Request) {
  if (!signInConfigured()) return notConfigured();
  const userId = await signedInUserId();
  if (!userId) return unauthorized();

  const parsed = welcomeRequest.safeParse(await readJson(request));
  if (!parsed.success) return fail(400, 'bad_request');
  const { displayName, avatar, theme, cohort, guestProfile } = parsed.data;

  const account: Account = {
    displayName,
    avatar: avatar as AvatarId,
    showOnLeaderboard: true,
    condition: 'adaptive',
  };
  const store = createStore(await database());
  await store.createAccount(userId, {
    account,
    cohort,
    consentAt: new Date().toISOString(),
    profile: startingProfile(userId, theme as ThemeId, guestProfile),
  });
  const learner = await store.loadLearner(userId);
  return ok({ account, profile: learner?.profile ?? null });
}
