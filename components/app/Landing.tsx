'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useSyncExternalStore } from 'react';
import { LinkButton } from '@/components/ui/Button';
import { CONFIG } from '@/lib/config';
import { th } from '@/lib/content/th';
import { cohortFromLink } from '@/lib/sync/types';
import { NotebookDemo } from './NotebookDemo';
import { GoogleButton } from './SignInButtons';
import { useLearner } from './useLearner';

const [taglineLead, taglineRest] = th.home.tagline.split(' ');

const COHORT_KEY = 'math:cohort';

/** A trial's link is /?cohort=ABC. Kept until the first sign-in comes back from Google. */
function rememberCohort() {
  const cohort = cohortFromLink(new URLSearchParams(window.location.search).get('cohort'));
  if (!cohort) return;
  try {
    window.localStorage.setItem(COHORT_KEY, cohort);
  } catch {
    // Blocked storage: the student simply is not grouped.
  }
}

export function savedCohort(): string | undefined {
  try {
    return window.localStorage.getItem(COHORT_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

const noSubscribe = () => () => {};
const loginFailed = () => new URLSearchParams(window.location.search).has('login');
const notOnServer = () => false;

/** The first screen says what the app is by showing it: a wrong answer and why it is wrong. */
export function Landing() {
  const { phase, configured } = useLearner();
  const router = useRouter();
  const failed = useSyncExternalStore(noSubscribe, loginFailed, notOnServer);

  useEffect(rememberCohort, []);
  useEffect(() => {
    if (phase === 'needs_welcome') router.replace('/welcome');
  }, [phase, router]);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pt-10 pb-3 md:grid md:max-w-5xl md:grid-cols-2 md:content-center md:items-center md:gap-x-20 md:px-8">
      <header className="md:col-start-1">
        <h1 className="text-6xl leading-tight font-semibold tracking-tight">
          <span className="marker">{CONFIG.appName}</span>
        </h1>
        <p className="mt-2 font-display text-2xl leading-snug font-medium">
          <span className="block">{taglineLead}</span>
          <span className="block">{taglineRest}</span>
        </p>
        <p className="mt-1 text-sm text-muted">{th.home.opening}</p>
      </header>

      <NotebookDemo className="my-10 md:col-start-2 md:row-span-3 md:row-start-1 md:my-0" />

      <div className="mt-auto flex flex-col gap-1 md:col-start-1 md:mt-8">
        {failed && (
          <p role="alert" className="text-sm text-warn">
            {th.home.loginFailed}
          </p>
        )}
        {phase === 'ready' ? (
          <LinkButton href="/learn" className="w-full">
            {th.home.continue}
          </LinkButton>
        ) : (
          <>
            {configured && <GoogleButton />}
            <LinkButton
              href="/welcome?guest=1"
              variant={configured ? 'quiet' : 'primary'}
              className="w-full"
              size={configured ? 'md' : 'lg'}
            >
              {th.home.tryFirst}
            </LinkButton>
          </>
        )}
      </div>

      <Link
        href="/privacy"
        className="mx-auto flex min-h-11 items-center px-2 text-xs text-muted underline md:col-start-1 md:mx-0"
      >
        {th.home.privacy}
      </Link>
    </main>
  );
}
