// Signing in and out. Loaded only when a button is pressed, so the Supabase client stays out of every
// page's first load. It only ever talks to Supabase Auth: all data goes through our own /api routes.

async function browserClient() {
  const { createBrowserClient } = await import('@supabase/ssr');
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
  );
}

/** Leaves the page for Google. On failure it returns, and the caller shows what went wrong. */
export async function signInWithGoogle(): Promise<{ failed: boolean }> {
  try {
    const client = await browserClient();
    const { error } = await client.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    return { failed: error !== null };
  } catch {
    return { failed: true };
  }
}

export async function signOutOfGoogle(): Promise<void> {
  const client = await browserClient();
  await client.auth.signOut();
}
