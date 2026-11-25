import { describe, expect, it } from 'vitest';
import { createBoardCache } from './boardCache';

describe('the board cache', () => {
  it('asks the database once for requests close together, and again once the time is up', async () => {
    let clock = 0;
    let queries = 0;
    const board = createBoardCache(
      async (key) => {
        queries += 1;
        return `${key}#${queries}`;
      },
      { ttlMs: 15_000, now: () => clock },
    );
    const together = await Promise.all([board('all'), board('all'), board('all')]);
    expect(together).toEqual(['all#1', 'all#1', 'all#1']);
    clock = 14_999;
    expect(await board('all')).toBe('all#1');
    expect(await board('class')).toBe('class#2');
    clock = 15_000;
    expect(await board('all')).toBe('all#3');
    expect(queries).toBe(3);
  });

  it('does not keep a failed query', async () => {
    let fail = true;
    const board = createBoardCache(async () => {
      if (fail) throw new Error('down');
      return 'rows';
    });
    await expect(board('all')).rejects.toThrow('down');
    fail = false;
    expect(await board('all')).toBe('rows');
  });
});
