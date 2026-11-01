'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useSyncExternalStore } from 'react';
import { createLearner, INITIAL_STATE, type LearnerState } from '@/lib/client/learner';
import type { Profile } from '@/lib/director/types';

function randomId(): string {
  // randomUUID needs https or localhost, and a phone on the school Wi-Fi testing a dev server has neither.
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
}

export const learner = createLearner({
  storage: () => window.localStorage,
  fetch: (...args) => window.fetch(...args),
  randomId,
  later: (run, ms) => {
    const timer = setTimeout(run, ms);
    return () => clearTimeout(timer);
  },
});

let watching = false;

function watchConnection() {
  if (watching) return;
  watching = true;
  window.addEventListener('online', () => void learner.flush());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void learner.flush();
  });
}

export function useLearner(): LearnerState {
  const state = useSyncExternalStore(learner.subscribe, learner.getState, () => INITIAL_STATE);
  useEffect(() => {
    watchConnection();
    void learner.boot();
  }, []);
  return state;
}

/** For pages that need a student: sends anyone else where they should be. Null while that happens. */
export function useRequiredProfile(): Profile | null {
  const { phase, profile } = useLearner();
  const router = useRouter();
  useEffect(() => {
    if (phase === 'signed_out') router.replace('/');
    if (phase === 'needs_welcome') router.replace('/welcome');
  }, [phase, router]);
  return phase === 'ready' ? profile : null;
}
