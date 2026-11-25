'use client';

import { useEffect, useId, type CSSProperties } from 'react';
import { Button } from '@/components/ui/Button';
import { CountUp, prefersStill } from '@/components/ui/CountUp';
import { CheckIcon } from '@/components/ui/Icons';
import { sfx } from '@/lib/client/sfx';
import { th } from '@/lib/content/th';
import { fillTokens } from '@/lib/core/tokens';
import { dayOf, lastDays } from '@/lib/learner/activity';
import type { DayActivity } from '@/lib/learner/types';

// The first finish of a day: the flame fills from the bottom, the count goes up by one, and the week
// shows which days were kept. It comes once a day, before the summary, and stands still where motion is
// not wanted, already full.

/** How long the flame takes to fill: the count and the sound come as it tops out. */
const FILL_MS = 1100;

const FLAME =
  'M60 6C66 30 96 46 104 82C112 118 90 146 60 146C30 146 8 122 14 90C18 68 32 58 38 44C42 58 46 66 54 70C50 48 52 26 60 6Z';
const CORE =
  'M60 72C66 88 84 98 82 116C80 132 70 140 60 140C48 140 38 130 40 114C42 102 52 96 54 84C56 92 58 96 62 98C60 88 58 80 60 72Z';

/** Sparks around the flame's tip as it tops out: where they sit, and when each goes off. */
const SPARKS = [
  { left: '12%', top: '18%', delay: 0 },
  { left: '82%', top: '12%', delay: 90 },
  { left: '4%', top: '52%', delay: 170 },
  { left: '92%', top: '46%', delay: 60 },
  { left: '48%', top: '-6%', delay: 140 },
];

const STORAGE_KEY = (student: string) => `math:streak-shown:${student}`;

/** Whether this student has already seen today's flame, on this device. */
export function streakShownToday(student: string, now: number): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY(student)) === dayOf(now);
  } catch {
    return false;
  }
}

export function markStreakShown(student: string, now: number): void {
  try {
    window.localStorage.setItem(STORAGE_KEY(student), dayOf(now));
  } catch {
    // Blocked storage: the flame may come again today, which is no harm.
  }
}

function weekdayOf(day: string): number {
  return (new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7;
}

function BigFlame() {
  const id = useId();
  const fill = `${id}-fill`;
  const clip = `${id}-clip`;
  return (
    <svg viewBox="0 0 120 150" className="h-44 w-auto overflow-visible" aria-hidden>
      <defs>
        <linearGradient id={fill} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" style={{ stopColor: 'var(--flame)' }} />
          <stop offset="1" style={{ stopColor: 'var(--cta)' }} />
        </linearGradient>
        <clipPath id={clip}>
          <rect
            width="120"
            height="150"
            className="[transform-box:fill-box] motion-safe:animate-fill-up"
          />
        </clipPath>
      </defs>
      {/* The empty flame, drawn in pencil, which the fire rises into. */}
      <path
        d={FLAME}
        fill="var(--sunken)"
        stroke="var(--edge)"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <g clipPath={`url(#${clip})`}>
        <g className="origin-bottom [transform-box:fill-box] motion-safe:animate-flicker">
          <path
            d={FLAME}
            fill={`url(#${fill})`}
            stroke="var(--flame)"
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <path d={CORE} fill="var(--cta)" opacity="0.9" />
        </g>
      </g>
    </svg>
  );
}

function WeekStrip({ activity, now }: { activity: readonly DayActivity[]; now: number }) {
  const today = dayOf(now);
  return (
    <ol aria-label={th.streak.week} className="flex w-full justify-between gap-1">
      {lastDays(activity, now, 7).map(({ day, items }) => {
        const kept = items > 0;
        const name = th.profile.days[weekdayOf(day)];
        return (
          <li key={day} className="flex flex-1 flex-col items-center gap-1">
            <span className="text-xs text-muted">{name}</span>
            <span
              aria-label={kept ? `${name} ✓` : name}
              style={day === today ? { animationDelay: `${FILL_MS}ms` } : undefined}
              className={`flex size-9 items-center justify-center rounded-full border-2 ${
                kept ? 'border-flame bg-flame text-on-cta' : 'border-line bg-surface'
              } ${day === today ? 'motion-safe:animate-pop' : ''}`}
            >
              {kept && <CheckIcon className="size-4" />}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function StreakCelebration({
  streak,
  activity,
  now,
  onDone,
}: {
  streak: number;
  activity: readonly DayActivity[];
  now: number;
  onDone(): void;
}) {
  useEffect(() => {
    const timer = window.setTimeout(() => sfx.play('streak'), prefersStill() ? 0 : FILL_MS - 150);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center gap-5 px-5 py-10 text-center">
      <div className="relative mt-4">
        <BigFlame />
        {SPARKS.map(({ left, top, delay }) => (
          <span
            key={`${left}${top}`}
            aria-hidden
            style={
              { left, top, animationDelay: `${FILL_MS - 200 + delay}ms` } satisfies CSSProperties
            }
            className="absolute size-3 rounded-full bg-cta opacity-0 motion-safe:animate-spark"
          />
        ))}
      </div>
      <p
        style={{ animationDelay: `${FILL_MS - 100}ms` }}
        className="flex items-baseline gap-2 motion-safe:animate-pop"
      >
        <span className="font-matrix text-7xl leading-none font-semibold text-flame tabular-nums">
          <CountUp from={Math.max(0, streak - 1)} value={streak} delayMs={FILL_MS - 250} />
        </span>
        <span className="text-xl font-semibold">{th.streak.days}</span>
      </p>
      <h1 className="text-2xl leading-snug font-semibold">
        {streak <= 1 ? th.streak.first : fillTokens(th.streak.title, { n: String(streak) })}
      </h1>
      <p className="text-muted">{th.streak.body}</p>
      <WeekStrip activity={activity} now={now} />
      <Button className="mt-auto w-full" onClick={onDone}>
        {th.streak.next}
      </Button>
    </main>
  );
}
