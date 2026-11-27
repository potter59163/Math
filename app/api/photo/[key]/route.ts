import { signedInUserId, signInConfigured } from '@/lib/server/auth';
import { database } from '@/lib/server/db';
import { fail, notConfigured, unauthorized } from '@/lib/server/http';
import { PHOTO_KEY, photoFits } from '@/lib/server/photo';
import { createStore } from '@/lib/server/store';

// A photo its owner chose to show on the leaderboard (Potter, 27 Nov 2026). The board hands out the
// key, which is random and new with every photo, so this address never says whose photo it is. The
// store gives nothing once the owner has switched the showing off, left the board or removed the photo.

/** Only this browser keeps the picture, and briefly, so that switching it off shows within minutes. */
const KEPT = 'private, max-age=300';

type Params = { params: Promise<{ key: string }> };

/** For any signed-in student: whoever may see the board may see the photos shown on it. */
export async function GET(_request: Request, { params }: Params) {
  if (!signInConfigured()) return notConfigured();
  const userId = await signedInUserId();
  if (!userId) return unauthorized();

  const { key } = await params;
  if (!PHOTO_KEY.test(key)) return fail(404, 'no_photo');
  const photo = await createStore(await database()).loadSharedPhoto(key);
  // Checked here again, for a photo stored before uploads were: nothing of a size that could freeze a
  // phone is handed to someone else's browser. Its owner still gets it at their own address.
  if (!photo || !photoFits(photo.data, photo.type)) return fail(404, 'no_photo');
  return new Response(photo.data as BodyInit, {
    headers: {
      'Content-Type': photo.type,
      'Cache-Control': KEPT,
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'",
    },
  });
}
