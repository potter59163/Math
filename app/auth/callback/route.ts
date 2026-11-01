import { NextResponse } from 'next/server';
import { requestClient, supabaseConfigured } from '@/lib/server/supabase';

/**
 * Google sends the student back here through Supabase with a one-time code. The code becomes a session
 * cookie, and the app works out from there whether this is a first visit.
 */
export async function GET(request: Request) {
  const { origin, searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  if (code && supabaseConfigured()) {
    const { error } = await (await requestClient()).auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}/learn`);
  }
  return NextResponse.redirect(`${origin}/?login=failed`);
}
