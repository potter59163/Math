'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useSyncExternalStore } from 'react';
import { profileStore } from '@/lib/practice/store';
import type { Profile } from '@/lib/practice/types';

const beforeHydration = () => undefined;

/** Undefined until the browser can read storage, then the signed-in profile or null. */
export function useProfile(): Profile | null | undefined {
  return useSyncExternalStore(profileStore.subscribe, profileStore.get, beforeHydration);
}

/** For pages that need a student: sends anyone not signed in to /join. Null while that happens. */
export function useRequiredProfile(): Profile | null {
  const profile = useProfile();
  const router = useRouter();
  useEffect(() => {
    if (profile === null) router.replace('/join');
  }, [profile, router]);
  return profile ?? null;
}
