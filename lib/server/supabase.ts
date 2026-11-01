import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

// The only place that reads the Supabase keys. The service role key has no NEXT_PUBLIC_ prefix, so it
// can never reach a browser bundle, and this file refuses to be imported by one.

function env() {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  };
}

/** False until the keys are set. The app then runs for guests alone, with nothing to sign in to. */
export function supabaseConfigured(): boolean {
  const { url, anonKey, serviceKey } = env();
  return Boolean(url && anonKey && serviceKey);
}

/** Bound to this request's cookies, so a refreshed session is written back to the student's browser. */
export async function requestClient(): Promise<SupabaseClient> {
  const { url, anonKey } = env();
  const store = await cookies();
  return createServerClient(url, anonKey, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        for (const { name, value, options } of list) store.set(name, value, options);
      },
    },
  });
}

/** Checked with Supabase on every call: a cookie alone proves nothing. */
export async function signedInUserId(): Promise<string | null> {
  if (!supabaseConfigured()) return null;
  const { data, error } = await (await requestClient()).auth.getUser();
  return error ? null : (data.user?.id ?? null);
}

let admin: SupabaseClient | undefined;

/** Bypasses row level security, so every query made with it must be scoped to a checked user id. */
export function adminClient(): SupabaseClient {
  const { url, serviceKey } = env();
  admin ??= createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return admin;
}
