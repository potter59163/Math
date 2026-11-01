import { NextResponse } from 'next/server';

// Nothing a route sends is about anyone but the signed-in student, so nothing may be cached on the way.
const NO_STORE = { 'Cache-Control': 'no-store' };

/** Large enough for a batch of 50 actions or a guest's whole profile. */
const MAX_BODY_BYTES = 2 * 1024 * 1024;

export function ok<T>(body: T): NextResponse<T> {
  return NextResponse.json(body, { headers: NO_STORE });
}

export function fail(status: number, error: string): NextResponse<{ error: string }> {
  return NextResponse.json({ error }, { status, headers: NO_STORE });
}

export const unauthorized = () => fail(401, 'not_signed_in');
export const notConfigured = () => fail(503, 'not_configured');

/** Null when the body is too large or is not JSON. */
export async function readJson(request: Request): Promise<unknown | null> {
  try {
    const text = await request.text();
    return text.length > MAX_BODY_BYTES ? null : JSON.parse(text);
  } catch {
    return null;
  }
}
