import { signedInUserId, signInConfigured } from '@/lib/server/auth';
import { database } from '@/lib/server/db';
import { fail, notConfigured, ok, unauthorized } from '@/lib/server/http';
import { PHOTO_KEY } from '@/lib/server/photo';
import { createStore } from '@/lib/server/store';

// A student says a photo shown on the leaderboard should not be there. Enough different students
// saying so takes it off the board (lib/server/store.ts, `reportPhoto`). Who reported is never told
// to anyone, and the reporter is whoever is signed in: nothing in the request can name another.

type Params = { params: Promise<{ key: string }> };

export async function POST(_request: Request, { params }: Params) {
  if (!signInConfigured()) return notConfigured();
  const userId = await signedInUserId();
  if (!userId) return unauthorized();

  const { key } = await params;
  if (!PHOTO_KEY.test(key)) return fail(404, 'no_photo');
  const result = await createStore(await database()).reportPhoto(key, userId, new Date());
  if (result === 'too_many') return fail(429, 'too_many');
  // The same answer whether it counted or not: a photo already down, one's own, a second try.
  return ok({ reported: true });
}
