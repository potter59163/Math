'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useSyncExternalStore } from 'react';
import { LinkButton } from '@/components/ui/Button';
import { MatrixView } from '@/components/ui/MatrixView';
import { CONFIG } from '@/lib/config';
import { th } from '@/lib/content/th';
import { cohortFromLink } from '@/lib/sync/types';
import { matrix } from '@/lib/topics/matrix/ops';
import { Mascot } from './Mascot';
import { GoogleButton } from './SignInButtons';
import { useLearner } from './useLearner';

// Decoration only. Every number a student works with comes from the generators.
const SAMPLE = matrix([
  [2, 1],
  [3, 4],
]);

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

export function Landing() {
  const { phase, configured } = useLearner();
  const router = useRouter();
  const failed = useSyncExternalStore(noSubscribe, loginFailed, notOnServer);

  useEffect(rememberCohort, []);
  useEffect(() => {
    if (phase === 'needs_welcome') router.replace('/welcome');
  }, [phase, router]);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-5 px-4 py-6 md:justify-center">
      <header className="flex flex-col items-center gap-3 text-center">
        <div className="flex items-center gap-4">
          <Mascot className="size-16 motion-safe:animate-float" />
          <div className="text-xl">
            <MatrixView value={SAMPLE} />
          </div>
        </div>
        <h1 className="text-3xl leading-tight font-bold">{CONFIG.appName}</h1>
        <p className="font-semibold text-brand">{th.home.tagline}</p>
      </header>

      <div className="flex flex-col gap-2">
        {failed && (
          <p role="alert" className="text-center text-sm text-warn">
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
            <p className="text-center text-xs text-muted">{th.home.guestNote}</p>
          </>
        )}
      </div>

      <p className="text-center text-muted">{th.home.description}</p>
      <ul className="flex flex-col gap-2">
        {th.home.features.map(({ title, body }) => (
          <li key={title} className="rounded-2xl border border-line bg-surface px-4 py-3">
            <p className="font-bold">{title}</p>
            <p className="text-sm text-muted">{body}</p>
          </li>
        ))}
      </ul>

      <Link
        href="/privacy"
        className="mx-auto flex min-h-11 items-center px-2 text-sm text-muted underline"
      >
        {th.home.privacy}
      </Link>
    </main>
  );
}
