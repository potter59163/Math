import { NextResponse } from 'next/server';
import { googleClient, signInConfigured, signInCookie } from '@/lib/server/auth';
import { beginSignIn, encodePending } from '@/lib/server/google';

/** The Google button leads here, and this sends the browser on to Google's own page. */
export async function GET(request: Request) {
  const { origin } = new URL(request.url);
  const client = googleClient();
  if (!client || !signInConfigured()) return NextResponse.redirect(`${origin}/?login=failed`);

  const { url, pending } = beginSignIn(client.clientId, `${origin}/auth/callback`);
  const response = NextResponse.redirect(url);
  response.cookies.set(signInCookie(encodePending(pending)));
  return response;
}
