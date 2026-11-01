import type { DayActivity } from './types';

// Days of work, for the streak and the daily goal. Thailand has one time zone and no daylight saving,
// so a fixed offset is right everywhere the app is used. The clock time is always passed in.

const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** More than a year back is never shown, and this keeps the profile small. */
const MAX_DAYS = 400;

export function dayOf(at: number): string {
  return new Date(at + BANGKOK_OFFSET_MS).toISOString().slice(0, 10);
}

export function logActivity(
  activity: readonly DayActivity[] | undefined,
  at: number,
  xp: number,
): DayActivity[] {
  const days = activity ?? [];
  const day = dayOf(at);
  const last = days.at(-1);
  if (last?.day === day) {
    return [...days.slice(0, -1), { day, items: last.items + 1, xp: last.xp + xp }];
  }
  return [...days, { day, items: 1, xp }].slice(-MAX_DAYS);
}

function dayBefore(day: string): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) - DAY_MS).toISOString().slice(0, 10);
}

/** Days in a row with work. Today not done yet does not break it: yesterday still counts. */
export function streakOf(activity: readonly DayActivity[] | undefined, now: number): number {
  const days = new Set((activity ?? []).map(({ day }) => day));
  const today = dayOf(now);
  let day = days.has(today) ? today : dayBefore(today);
  let streak = 0;
  while (days.has(day)) {
    streak += 1;
    day = dayBefore(day);
  }
  return streak;
}

export function itemsOn(activity: readonly DayActivity[] | undefined, now: number): number {
  const today = dayOf(now);
  return activity?.find(({ day }) => day === today)?.items ?? 0;
}

/** The last `count` days, oldest first, with the days of no work filled in. */
export function lastDays(
  activity: readonly DayActivity[] | undefined,
  now: number,
  count: number,
): DayActivity[] {
  const byDay = new Map((activity ?? []).map((entry) => [entry.day, entry]));
  const days: DayActivity[] = [];
  let day = dayOf(now);
  for (let n = 0; n < count; n += 1) {
    days.unshift(byDay.get(day) ?? { day, items: 0, xp: 0 });
    day = dayBefore(day);
  }
  return days;
}
