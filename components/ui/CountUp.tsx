'use client';

import { useEffect, useState } from 'react';

/** Whether this device wants things still: the system's setting, or the app's own (data-motion). */
export function prefersStill(): boolean {
  if (typeof window === 'undefined') return true;
  return (
    document.documentElement.dataset.motion === 'reduce' ||
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * A number that counts up to its value once, eased, or simply shows it where motion is not wanted. It
 * only ever mounts in the browser, once a profile is there to count from.
 */
export function CountUp({
  value,
  from = 0,
  delayMs = 0,
  durationMs = 700,
}: {
  value: number;
  from?: number;
  delayMs?: number;
  durationMs?: number;
}) {
  const [shown, setShown] = useState(() => (prefersStill() ? value : from));
  useEffect(() => {
    if (prefersStill()) return;
    let frame = 0;
    const start = performance.now() + delayMs;
    const tick = (now: number) => {
      const t = Math.min(1, Math.max(0, (now - start) / durationMs));
      setShown(Math.round(from + (value - from) * (1 - (1 - t) ** 3)));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    // A browser that holds back animation frames, as it does for a tab out of sight, still lands on the value.
    const settle = window.setTimeout(() => setShown(value), delayMs + durationMs + 100);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(settle);
    };
  }, [value, from, delayMs, durationMs]);
  return <>{shown}</>;
}
