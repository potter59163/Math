import { describe, expect, it } from 'vitest';
import { rankEntries, SHOWN_ON_BOARD, weekStartOf } from './leaderboard';

const row = (user_id: string, xp: number) => ({
  user_id,
  display_name: 'ชื่อเล่น',
  avatar: 'pi',
  xp,
});

describe('weekStartOf', () => {
  it('is Monday at midnight in Thailand', () => {
    // Wednesday 2026-11-04, 10:00 in Bangkok.
    expect(weekStartOf(Date.UTC(2026, 10, 4, 3))).toBe('2026-11-01T17:00:00.000Z');
  });
  it('counts Sunday night as the week before', () => {
    // Sunday 2026-11-01, 23:00 in Bangkok.
    expect(weekStartOf(Date.UTC(2026, 10, 1, 16))).toBe('2026-10-25T17:00:00.000Z');
  });
  it('counts Monday 00:30 in Bangkok as the new week, though it is still Sunday in UTC', () => {
    expect(weekStartOf(Date.UTC(2026, 10, 1, 17, 30))).toBe('2026-11-01T17:00:00.000Z');
  });
});

describe('rankEntries', () => {
  it('gives equal XP an equal rank, and the next one its true place', () => {
    const { entries } = rankEntries([row('a', 30), row('b', 30), row('c', 10)], 'c', 'w', false);
    expect(entries.map(({ rank }) => rank)).toEqual([1, 1, 3]);
    expect(entries[2].isMe).toBe(true);
  });
  it('sends no user id to the browser', () => {
    const board = rankEntries([row('secret-id', 5)], 'secret-id', 'w', false);
    expect(JSON.stringify(board)).not.toContain('secret-id');
  });
  it('still tells a student their place when they are below the list', () => {
    const rows = Array.from({ length: SHOWN_ON_BOARD + 5 }, (_, n) => row(`u${n}`, 1000 - n));
    const board = rankEntries(rows, `u${SHOWN_ON_BOARD + 2}`, 'w', false);
    expect(board.entries).toHaveLength(SHOWN_ON_BOARD);
    expect(board.me?.rank).toBe(SHOWN_ON_BOARD + 3);
  });
  it('has no place for a student with none this week', () => {
    expect(rankEntries([row('a', 5)], 'b', 'w', false).me).toBeNull();
  });
});
