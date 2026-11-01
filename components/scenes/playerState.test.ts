import { describe, expect, it } from 'vitest';
import {
  initialPlayer,
  playerReducer,
  viewOf,
  type PlayerAction,
  type PlayerState,
} from './playerState';

const run = (total: number, ...actions: PlayerAction['type'][]): PlayerState =>
  actions.reduce((state, type) => playerReducer(state, { type }), initialPlayer(total));

describe('playerReducer', () => {
  it('starts on the first beat, having seen only that one', () => {
    expect(viewOf(initialPlayer(4), 0)).toEqual({
      beatsTotal: 4,
      beatsSeen: 1,
      replays: 0,
      skipped: false,
      durationMs: 0,
    });
  });

  it('moves one beat per tap, and the last tap finishes the scene', () => {
    expect(run(3, 'next').beat).toBe(1);
    expect(run(3, 'next', 'next').beat).toBe(2);
    expect(run(3, 'next', 'next').finished).toBe(false);
    const done = run(3, 'next', 'next', 'next');
    expect(done.finished).toBe(true);
    expect(done.beat).toBe(2);
    expect(viewOf(done, 9000)).toEqual({
      beatsTotal: 3,
      beatsSeen: 3,
      replays: 0,
      skipped: false,
      durationMs: 9000,
    });
  });

  it('replay goes back to the first beat, counts the replay and keeps what was seen', () => {
    const state = run(4, 'next', 'next', 'replay');
    expect(state.beat).toBe(0);
    expect(viewOf(state, 0)).toMatchObject({ beatsSeen: 3, replays: 1 });
    expect(viewOf(run(4, 'next', 'replay', 'replay'), 0).replays).toBe(2);
  });

  it('counts the furthest beat, not the last one, after a replay', () => {
    const state = run(4, 'next', 'next', 'next', 'replay', 'next');
    expect(state.beat).toBe(1);
    expect(viewOf(state, 0).beatsSeen).toBe(4);
  });

  it('skip ends the scene and says so', () => {
    const state = run(4, 'next', 'skip');
    expect(state.finished).toBe(true);
    expect(viewOf(state, 1000)).toMatchObject({ beatsSeen: 2, skipped: true });
  });

  it('skipping once every beat was seen does not count as skipping', () => {
    expect(viewOf(run(2, 'next', 'skip'), 0).skipped).toBe(false);
    expect(viewOf(run(3, 'next', 'next', 'replay', 'skip'), 0).skipped).toBe(false);
  });

  it('ignores anything after the end', () => {
    const done = run(2, 'skip');
    expect(playerReducer(done, { type: 'next' })).toBe(done);
    expect(playerReducer(done, { type: 'replay' })).toBe(done);
    expect(playerReducer(done, { type: 'skip' })).toBe(done);
  });

  it('a one-beat scene finishes on the first tap', () => {
    expect(run(1, 'next').finished).toBe(true);
    expect(viewOf(run(1, 'next'), 0).skipped).toBe(false);
  });
});
