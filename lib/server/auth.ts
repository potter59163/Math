import 'server-only';
import { cookies } from 'next/headers';
import { createAuthStore, SESSION_MAX_AGE_S } from './authStore';
import { database, databaseConfigured } from './db';
import type { GoogleClient } from './google';

// The only place that reads the Google keys and the session cookie. Neither has a NEXT_PUBLIC_ prefix, so
// neither can reach a browser bundle, and this file refuses to be imported by one.

export const SESSION_COOKIE = 'kidma_session';
export const SIGN_IN_COOKIE = 'kidma_sign_in';

const SIGN_IN_MAX_AGE_S = 10 * 60;

// http://localhost in development has no TLS, and browsers would drop a Secure cookie on a LAN address.
const secure = process.env.NODE_ENV === 'production';

export function googleClient(): GoogleClient | null {
  const clientId = process.env.GOOGLE_CLIENT_ID ?? '';
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET ?? '';
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

/** False until the keys are set. The app then runs for guests alone, with nothing to sign in to. */
export function signInConfigured(): boolean {
  return databaseConfigured() && googleClient() !== null;
}

/** Looked up on every call: a cookie alone proves nothing, and signing out must end it at once. */
export async function signedInUserId(): Promise<string | null> {
  if (!signInConfigured()) return null;
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return createAuthStore(await database()).userOfSession(token);
}

export function sessionCookie(token: string) {
  return {
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    secure,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: SESSION_MAX_AGE_S,
  };
}

/** Lax, because the browser comes back from Google on a link, and only /auth ever needs to see it. */
export function signInCookie(pending: string) {
  return {
    name: SIGN_IN_COOKIE,
    value: pending,
    httpOnly: true,
    secure,
    sameSite: 'lax' as const,
    path: '/auth',
    maxAge: SIGN_IN_MAX_AGE_S,
  };
}
