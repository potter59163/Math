'use client';

import dynamic from 'next/dynamic';
import { useEffect } from 'react';
import { th } from '@/lib/content/th';
import type { ScenePlayerProps } from './ScenePlayer';

/** A clip that cannot load must not stop the lesson, so it closes as if skipped. */
function SceneUnavailable({ onDone }: ScenePlayerProps) {
  useEffect(() => onDone(), [onDone]);
  return null;
}

// `motion` and the templates load with the first clip, so they stay out of the first page.
export const LazyScene = dynamic<ScenePlayerProps>(
  () =>
    import('./ScenePlayer').then(({ ScenePlayer }) => ScenePlayer).catch(() => SceneUnavailable),
  {
    ssr: false,
    loading: () => (
      <div
        role="status"
        className="fixed inset-0 z-50 flex items-center justify-center bg-canvas text-muted"
      >
        {th.common.loading}
      </div>
    ),
  },
);

/**
 * Fetches the player soon after the page settles, so a slow school connection does not delay the help
 * button. Returns its own cleanup, for use as an effect.
 */
export function preloadScenes(): () => void {
  const timer = setTimeout(() => void import('./ScenePlayer').catch(() => {}), 2000);
  return () => clearTimeout(timer);
}
