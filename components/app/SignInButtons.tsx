'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { Button, buttonClass } from '@/components/ui/Button';
import { GoogleIcon } from '@/components/ui/Icons';
import { inAppBrowserOf, lineExternalUrl, type InAppBrowser } from '@/lib/client/inAppBrowser';
import { th } from '@/lib/content/th';

const noSubscribe = () => () => {};
const inAppNow = (): InAppBrowser | null => inAppBrowserOf(window.navigator.userAgent);
const onServer = (): InAppBrowser | null => null;

/** Google's own refusal page explains nothing, so a student inside LINE or Facebook sees this instead. */
function OpenInBrowser({ browser }: { browser: InAppBrowser }) {
  return (
    <div role="status" className="flex flex-col gap-2 rounded-xl bg-warn-soft p-4">
      <p className="font-bold text-warn">{th.home.inApp.title}</p>
      <p>{th.home.inApp.body}</p>
      {browser === 'line' && (
        <Button onClick={() => window.location.assign(lineExternalUrl(window.location.href))}>
          {th.home.inApp.line}
        </Button>
      )}
    </div>
  );
}

/**
 * A plain link and not next/link: it leads to a route that leaves for Google, and it works before this
 * page's script has loaded on a slow school network. If that goes wrong the student comes back to
 * /?login=failed, which the first page explains.
 */
export function GoogleButton({ label = th.home.signIn }: { label?: string }) {
  const [going, setGoing] = useState(false);
  const browser = useSyncExternalStore(noSubscribe, inAppNow, onServer);

  // The back button from Google's page brings this page back exactly as it was left: still going.
  useEffect(() => {
    const cameBack = (event: PageTransitionEvent) => {
      if (event.persisted) setGoing(false);
    };
    window.addEventListener('pageshow', cameBack);
    return () => window.removeEventListener('pageshow', cameBack);
  }, []);

  if (browser) return <OpenInBrowser browser={browser} />;

  return (
    <a
      href="/auth/google"
      className={buttonClass({ variant: 'outline' }, 'w-full')}
      aria-busy={going}
      onClick={() => setGoing(true)}
    >
      <GoogleIcon className="size-5 shrink-0" />
      {going ? th.home.signingIn : label}
    </a>
  );
}
