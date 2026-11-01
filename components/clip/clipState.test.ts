import { describe, expect, it } from 'vitest';
import { clipReducer, initialClip } from './clipState';

describe('clipReducer', () => {
  it('starts at the first beat, playing', () => {
    expect(initialClip(3)).toEqual({ index: 0, total: 3, paused: false, runs: 0 });
  });

  it('moves on, and stops at the last beat', () => {
    let state = initialClip(2);
    state = clipReducer(state, { type: 'next' });
    expect(state.index).toBe(1);
    state = clipReducer(state, { type: 'next' });
    expect(state.index).toBe(1);
  });

  it('goes back, and stops at the first beat', () => {
    let state = clipReducer(initialClip(3), { type: 'next' });
    state = clipReducer(state, { type: 'back' });
    expect(state.index).toBe(0);
    expect(clipReducer(state, { type: 'back' }).index).toBe(0);
  });

  it('pauses and plays again, staying where it is', () => {
    const moved = clipReducer(initialClip(3), { type: 'next' });
    const paused = clipReducer(moved, { type: 'toggle' });
    expect(paused).toMatchObject({ index: 1, paused: true });
    expect(clipReducer(paused, { type: 'toggle' })).toMatchObject({ index: 1, paused: false });
  });

  it('plays on after a step, since whoever stepped wants to keep watching', () => {
    const paused = clipReducer(initialClip(3), { type: 'toggle' });
    expect(clipReducer(paused, { type: 'next' }).paused).toBe(false);
    expect(clipReducer(paused, { type: 'back' }).paused).toBe(false);
  });

  it('replays from the top, and counts it so the drawing starts clean', () => {
    const late = clipReducer(clipReducer(initialClip(3), { type: 'next' }), { type: 'next' });
    expect(clipReducer(late, { type: 'replay' })).toMatchObject({ index: 0, runs: 1 });
  });
});
