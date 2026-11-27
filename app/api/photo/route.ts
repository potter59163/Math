import { signedInUserId, signInConfigured } from '@/lib/server/auth';
import { database } from '@/lib/server/db';
import { fail, notConfigured, ok, unauthorized } from '@/lib/server/http';
import { MAX_PHOTO_BYTES, photoFits, photoSizeOf, photoTypeOf } from '@/lib/server/photo';
import { createStore } from '@/lib/server/store';

// A student's own profile photo. This address serves it back to that student alone. Others see it only
// if its owner switched that on, and then by its key, at /api/photo/[key] (SPEC §15).

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
  // This app sends 256 px. A file that states no size is no picture, and one that states a huge size
  // could freeze the device of whoever is shown it, so neither is kept (lib/server/photo.ts).
  if (!photoSizeOf(bytes, type)) return fail(415, 'not_an_image');
  if (!photoFits(bytes, type)) return fail(413, 'too_big');

  const photoAt = await createStore(await database()).savePhoto(userId, { type, data: bytes });
  // Signed in, but the welcome is not finished: nothing is stored before consent (SPEC §15).
  if (!photoAt) return fail(409, 'no_account');
  return ok({ photoAt });
}

export async function DELETE() {
  if (!signInConfigured()) return notConfigured();
  const userId = await signedInUserId();
  if (!userId) return unauthorized();

  await createStore(await database()).deletePhoto(userId);
  return ok({ photoAt: null });
}
