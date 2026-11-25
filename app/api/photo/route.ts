import { signedInUserId, signInConfigured } from '@/lib/server/auth';
import { database } from '@/lib/server/db';
import { fail, notConfigured, ok, unauthorized } from '@/lib/server/http';
import { MAX_PHOTO_BYTES, photoTypeOf } from '@/lib/server/photo';
import { createStore } from '@/lib/server/store';

// A student's own profile photo. It is served back to that student alone: the leaderboard and everyone
// else see the symbol they chose (SPEC §15).

/** This student's photo, never anyone else's. */
export async function GET() {
  if (!signInConfigured()) return notConfigured();
  const userId = await signedInUserId();
  if (!userId) return unauthorized();

  const photo = await createStore(await database()).loadPhoto(userId);
  if (!photo) return fail(404, 'no_photo');
  return new Response(photo.data as BodyInit, {
    headers: {
      'Content-Type': photo.type,
      // Only this browser keeps it, and asks again after a change (the address carries photoAt).
      'Cache-Control': 'private, no-cache',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'",
    },
  });
}

/** The bytes of a small picture, whose type is read from the bytes themselves. */
export async function PUT(request: Request) {
  if (!signInConfigured()) return notConfigured();
  const userId = await signedInUserId();
  if (!userId) return unauthorized();

  if (Number(request.headers.get('content-length') ?? 0) > MAX_PHOTO_BYTES) {
    return fail(413, 'too_big');
  }
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.length === 0) return fail(400, 'bad_request');
  if (bytes.length > MAX_PHOTO_BYTES) return fail(413, 'too_big');
  const type = photoTypeOf(bytes);
  if (!type) return fail(415, 'not_an_image');

  const photoAt = await createStore(await database()).savePhoto(userId, { type, data: bytes });
  return ok({ photoAt });
}

export async function DELETE() {
  if (!signInConfigured()) return notConfigured();
  const userId = await signedInUserId();
  if (!userId) return unauthorized();

  await createStore(await database()).deletePhoto(userId);
  return ok({ photoAt: null });
}
