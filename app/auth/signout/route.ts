import type { NextRequest } from 'next/server';
import { ok } from '@/lib/server/http';
import { SESSION_COOKIE, signInConfigured } from '@/lib/server/auth';
import { createAuthStore } from '@/lib/server/authStore';
import { database } from '@/lib/server/db';

/** Ends this device's session only, and leaves the student's Google account signed in as it was. */
export async function POST(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (token && signInConfigured()) {
    try {
      await createAuthStore(await database()).endSession(token);
    } catch (error) {
      // The cookie still goes, so this browser is signed out either way, and the session expires alone.
      console.error(`sign-out: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  const response = ok({ signedOut: true });
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
