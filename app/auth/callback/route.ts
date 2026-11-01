import { NextResponse, type NextRequest } from 'next/server';
import { googleClient, sessionCookie, SIGN_IN_COOKIE, signInConfigured } from '@/lib/server/auth';
import { createAuthStore } from '@/lib/server/authStore';
import { database } from '@/lib/server/db';
import {
  decodePending,
  finishSignIn,
  type GoogleClient,
  type PendingSignIn,
} from '@/lib/server/google';

async function startSessionFor(
  client: GoogleClient,
  code: string,
  pending: PendingSignIn,
  origin: string,
): Promise<string | null> {
  try {
    const redirectUri = `${origin}/auth/callback`;
    const googleSub = await finishSignIn({ client, redirectUri, code, pending });
    const auth = createAuthStore(await database());
    return await auth.startSession(await auth.userIdFor(googleSub));
  } catch (error) {
    console.error(`sign-in: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

/**
 * Google sends the student back here with a one-time code. The code becomes a session cookie, and the app
 * works out from there whether this is a first visit.
 */
export async function GET(request: NextRequest) {
  const { origin, searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const client = googleClient();
  const pending = decodePending(request.cookies.get(SIGN_IN_COOKIE)?.value);
  // The state ties this visit to the sign-in this browser started, so nobody can send a student here
  // with a code of their own and sign them in as someone else.
  const fromThisBrowser = pending !== null && searchParams.get('state') === pending.state;

  const token =
    code && client && fromThisBrowser && signInConfigured()
      ? await startSessionFor(client, code, pending, origin)
      : null;

  const response = NextResponse.redirect(`${origin}${token ? '/learn' : '/?login=failed'}`);
  response.cookies.set({ name: SIGN_IN_COOKIE, value: '', path: '/auth', maxAge: 0 });
  if (token) response.cookies.set(sessionCookie(token));
  return response;
}
