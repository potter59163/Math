import { describe, expect, it } from 'vitest';
import { dayOf, itemsOn, lastDays, logActivity, streakOf } from './activity';

const bangkok = (day: string, hour = 12) =>
  Date.parse(`${day}T${String(hour).padStart(2, '0')}:00:00+07:00`);

describe('dayOf', () => {
  it('uses Thai time, so a late answer counts for the day it was in Thailand', () => {
    expect(dayOf(bangkok('2026-11-01', 23))).toBe('2026-11-01');
    expect(dayOf(bangkok('2026-11-02', 1))).toBe('2026-11-02');
  });
});

describe('logActivity', () => {
  it('adds up within a day and starts a new entry on the next', () => {
    let days = logActivity(undefined, bangkok('2026-11-01'), 10);
    days = logActivity(days, bangkok('2026-11-01', 13), 7);
    days = logActivity(days, bangkok('2026-11-02'), 0);
    expect(days).toEqual([
      { day: '2026-11-01', items: 2, xp: 17 },
      { day: '2026-11-02', items: 1, xp: 0 },
    ]);
  });
});

describe('streakOf', () => {
  const on = (...dates: string[]) => dates.map((day) => ({ day, items: 1, xp: 1 }));
  it('counts days in a row up to today', () => {
    expect(streakOf(on('2026-11-01', '2026-11-02', '2026-11-03'), bangkok('2026-11-03'))).toBe(3);
  });
  it('is not broken by today not being done yet', () => {
    expect(streakOf(on('2026-11-01', '2026-11-02'), bangkok('2026-11-03'))).toBe(2);
  });
  it('is broken by a whole day missed', () => {
    expect(streakOf(on('2026-11-01'), bangkok('2026-11-03'))).toBe(0);
    expect(streakOf(on('2026-10-30', '2026-11-02'), bangkok('2026-11-02'))).toBe(1);
  });
  it('crosses a month', () => {
    expect(streakOf(on('2026-10-31', '2026-11-01'), bangkok('2026-11-01'))).toBe(2);
  });
  it('is zero with nothing done', () => {
    expect(streakOf(undefined, bangkok('2026-11-01'))).toBe(0);
  });
});

describe('daily views', () => {
  it('reads today', () => {
    const days = [{ day: '2026-11-01', items: 4, xp: 40 }];
    expect(itemsOn(days, bangkok('2026-11-01'))).toBe(4);
    expect(itemsOn(days, bangkok('2026-11-02'))).toBe(0);
  });
  it('fills the days with no work, oldest first', () => {
    const week = lastDays([{ day: '2026-11-01', items: 4, xp: 40 }], bangkok('2026-11-03'), 3);
    expect(week.map(({ day, items }) => [day, items])).toEqual([
      ['2026-11-01', 4],
      ['2026-11-02', 0],
      ['2026-11-03', 0],
    ]);
  });
});
