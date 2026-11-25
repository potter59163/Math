'use client';

import { useEffect, useState } from 'react';
import { Mascot } from '@/components/app/Mascot';
import { th } from '@/lib/content/th';

/** Most waits are a blink, so nothing shows for the first moment: a flash of text reads as a glitch. */
const QUIET_MS = 300;

export function LoadingScreen() {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setShown(true), QUIET_MS);
    return () => clearTimeout(timer);
  }, []);
  return (
    <main role="status" className="flex min-h-dvh items-center justify-center">
      {shown && (
        <span className="flex flex-col items-center gap-2 text-muted motion-safe:animate-fade">
          <Mascot mood="thinking" className="size-12 -rotate-3" />
          {th.common.loading}
        </span>
      )}
    </main>
  );
}
