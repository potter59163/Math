import { describe, expect, it } from 'vitest';
import { storeAnswer } from '@/lib/core/answerJson';
import { currentItem } from '@/lib/director/items';
import { startSession, submitAttempt } from '@/lib/director/rules';
import { finishScene, finishTurn, newProfile } from '@/lib/director/turn';
import type { Profile } from '@/lib/director/types';
import type { MatrixItem } from '@/lib/topics/matrix/types';
import { applyAction } from './actions';

const fresh = (): Profile => newProfile({ id: 'student-1', units: [1, 2, 3, 4, 5], theme: 'game' });

function settled(profile: Profile): Profile {
  let p = profile;
  while (p.pending) p = finishScene(p);
  return p;
}

const finishTurnOf = (profile: Profile) =>
  profile.pending?.turn.scenes[0] ? profile : finishTurn(profile);

describe('applyAction', () => {
  it('gives the same result as the functions it stands for, which is what keeps two copies equal', () => {
    const start = settled(startSession(fresh()));
    const item = currentItem(start) as MatrixItem;
    const event = {
      item,
      answer: item.correct,
      hintLevel: 0 as const,
      timeMs: 5,
      at: 1_800_000_000_000,
    };
    const viaAction = applyAction(start, {
      type: 'attempt',
      ref: item.ref,
      answer: storeAnswer(item.correct),
      hintLevel: 0,
      timeMs: 5,
      at: event.at,
    });
    const direct = submitAttempt(start, event);
    expect(JSON.stringify(viaAction.profile)).toBe(JSON.stringify(direct.profile));
    expect(viaAction.outcome).toEqual(direct.outcome);
  });

  it('starts a session once, and a second start changes nothing', () => {
    const first = applyAction(fresh(), { type: 'start' });
    expect(first.turn?.trigger).toBe('session_start');
    const second = applyAction(first.profile, { type: 'start' });
    expect(second.turn).toBeUndefined();
    expect(second.profile).toBe(first.profile);
  });

  it('ignores an attempt on a ref it cannot rebuild, rather than throwing', () => {
    const start = fresh();
    const stale = { topic: 'matrix', skill: 'dim', difficulty: 1, seed: 1, gv: -1 } as const;
    const result = applyAction(start, {
      type: 'attempt',
      ref: stale,
      answer: { kind: 'dims', rows: 2, cols: 3 },
      hintLevel: 0,
      timeMs: 1,
      at: 1_800_000_000_000,
    });
    expect(result.profile).toBe(start);
    expect(result.outcome).toBeUndefined();
  });

  it('ignores an answer that is not a number, rather than throwing', () => {
    const start = settled(startSession(fresh()));
    const item = currentItem(start) as MatrixItem;
    const result = applyAction(start, {
      type: 'attempt',
      ref: item.ref,
      answer: { kind: 'scalar', value: 'not a number' },
      hintLevel: 0,
      timeMs: 1,
      at: 1_800_000_000_000,
    });
    expect(result.profile).toBe(start);
  });

  it('will not open a skill that is still locked', () => {
    const start = fresh();
    const result = applyAction(start, { type: 'practice', skill: 'inv2' });
    expect(result.turn).toBeUndefined();
    expect(result.profile).toBe(start);
  });

  it('opens an unlocked skill when the student picks it', () => {
    const result = applyAction(fresh(), { type: 'practice', skill: 'dim' });
    expect(result.turn?.next?.skill).toBe('dim');
  });

  it('changes the theme and nothing else', () => {
    const start = fresh();
    const { profile } = applyAction(start, { type: 'set_theme', theme: 'music' });
    expect(profile.student.theme).toBe('music');
    expect({ ...profile, student: start.student }).toEqual(start);
  });

  it('does not give a student the same item twice while another is possible', () => {
    let profile = newProfile({ id: 'student-2', units: [3] });
    profile = settled(applyAction(profile, { type: 'practice', skill: 'mult_defined' }).profile);
    const seen = new Set<string>();
    for (let n = 0; n < 8; n += 1) {
      const item = currentItem(profile) as MatrixItem;
      expect(seen.has(JSON.stringify(item.data)), `item ${n}`).toBe(false);
      seen.add(JSON.stringify(item.data));
      const next = applyAction(profile, {
        type: 'attempt',
        ref: item.ref,
        answer: storeAnswer(item.correct),
        hintLevel: 0,
        timeMs: 5,
        at: 1_800_000_000_000,
      });
      profile = settled(finishTurnOf(next.profile));
    }
  });
});
