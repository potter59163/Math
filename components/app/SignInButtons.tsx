'use client';

import { useState, useSyncExternalStore } from 'react';
import { Button } from '@/components/ui/Button';
import { GoogleIcon } from '@/components/ui/Icons';
import { signInWithGoogle } from '@/lib/client/auth';
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

export function GoogleButton({ label = th.home.signIn }: { label?: string }) {
  const [state, setState] = useState<'idle' | 'going' | 'failed'>('idle');
  const browser = useSyncExternalStore(noSubscribe, inAppNow, onServer);

  if (browser) return <OpenInBrowser browser={browser} />;

  return (
    <div className="flex flex-col gap-1">
      <Button
        variant="outline"
        className="w-full"
        aria-busy={state === 'going'}
        disabled={state === 'going'}
        onClick={async () => {
          setState('going');
          const { failed } = await signInWithGoogle();
          // On success the page has already left for Google.
          if (failed) setState('failed');
        }}
      >
        <GoogleIcon className="size-5 shrink-0" />
        {state === 'going' ? th.home.signingIn : label}
      </Button>
      {state === 'failed' && (
        <p role="alert" className="text-center text-sm text-warn">
          {th.home.loginFailed}
        </p>
      )}
    </div>
  );
}
