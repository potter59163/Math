import { describe, expect, it } from 'vitest';
import { storeAnswer } from '@/lib/core/answerJson';
import { currentItem } from '@/lib/director/items';
import { startSession } from '@/lib/director/rules';
import { finishScene, newProfile } from '@/lib/director/turn';
import type { Condition, Profile } from '@/lib/director/types';
import type { QueuedAction } from '@/lib/sync/types';
import type { MatrixItem } from '@/lib/topics/matrix/types';
import {
  NoLearnerError,
  processActions,
  type Decide,
  type LearnerRow,
  type LogEntry,
  type SyncStore,
} from './sync';

const AT = 1_800_000_000_000;

function settled(profile: Profile): Profile {
  let p = profile;
  while (p.pending) p = finishScene(p);
  return p;
}

interface Fake extends SyncStore {
  row: LearnerRow | null;
  logs: LogEntry[];
  saves: number;
  /** Someone else writes just before each of the next few saves. */
  conflicts: number;
}

function fakeStore(profile: Profile | null, condition: Condition = 'adaptive'): Fake {
  const store: Fake = {
    row: profile && { profile, rev: 0, devices: {}, condition },
    logs: [],
    saves: 0,
    conflicts: 0,
    loadLearner: async () => (store.row ? structuredClone(store.row) : null),
    saveLearner: async (_id, { profile: next, devices }, expected) => {
      store.saves += 1;
      if (store.conflicts > 0) {
        store.conflicts -= 1;
        store.row!.rev += 1;
        return false;
      }
      if (store.row!.rev !== expected) return false;
      store.row = { ...store.row!, profile: next, devices, rev: expected + 1 };
      return true;
    },
    writeLogs: async (_id, _device, logs) => {
      store.logs.push(...logs);
    },
  };
  return store;
}

const started = () => settled(startSession(newProfile({ id: 'u1', units: [1, 2, 3, 4, 5] })));

function attemptOn(profile: Profile, seq: number): QueuedAction {
  const item = currentItem(profile) as MatrixItem;
  return {
    seq,
    action: {
      type: 'attempt',
      ref: item.ref,
      answer: storeAnswer(item.correct),
      hintLevel: 0,
      timeMs: 10,
      at: AT,
    },
  };
}

const input = (store: SyncStore, actions: QueuedAction[], decide: Decide | null = null) => ({
  store,
  userId: 'u1',
  deviceId: 'device-a',
  actions,
  decide,
});

describe('processActions', () => {
  it('applies an answer, does its own XP, and logs the attempt with its decision', async () => {
    const profile = started();
    const store = fakeStore(profile);
    const result = await processActions(input(store, [attemptOn(profile, 1)]));
    expect(result.lastSeq).toBe(1);
    expect(result.profile.xp).toBe(10);
    expect(result.turn?.trigger).toBe('after_attempt');
    expect(store.logs.map(({ kind }) => kind)).toEqual(['attempt']);
  });

  it('changes nothing on a retry, so a lost response cannot pay twice', async () => {
    const profile = started();
    const store = fakeStore(profile);
    const batch = [attemptOn(profile, 1)];
    await processActions(input(store, batch));
    const retried = await processActions(input(store, batch));
    expect(retried.profile.xp).toBe(10);
    expect(retried.turn).toBeNull();
    expect(store.saves).toBe(1);
    expect(store.logs).toHaveLength(1);
  });

  it('keeps each device apart, so a second phone is not taken for a retry', async () => {
    const profile = started();
    const store = fakeStore(profile);
    await processActions(input(store, [attemptOn(profile, 1)]));
    const row = store.row!;
    const second = attemptOn(row.profile, 1);
    const result = await processActions({ ...input(store, [second]), deviceId: 'device-b' });
    expect(result.profile.xp).toBe(20);
    expect(store.row?.devices).toEqual({ 'device-a': 1, 'device-b': 1 });
  });

  it('reads again when another device wrote first, and loses neither', async () => {
    const profile = started();
    const store = fakeStore(profile);
    store.conflicts = 1;
    const result = await processActions(input(store, [attemptOn(profile, 1)]));
    expect(result.profile.xp).toBe(10);
    expect(store.saves).toBe(2);
    expect(store.logs).toHaveLength(1);
  });

  it('gives up with an error rather than losing an answer unseen', async () => {
    const profile = started();
    const store = fakeStore(profile);
    store.conflicts = 10;
    await expect(processActions(input(store, [attemptOn(profile, 1)]))).rejects.toThrow(
      'could not save',
    );
  });

  it('asks for a welcome when there is no student yet', async () => {
    await expect(processActions(input(fakeStore(null), []))).rejects.toBeInstanceOf(NoLearnerError);
  });

  it('asks the tutor about the answer on screen only, not ones sent while offline', async () => {
    const start = started();
    const asked: number[] = [];
    const decide: Decide = async (prepared) => {
      asked.push(prepared.after.itemsDone);
      return { tutor: { message: 'ทดสอบ' } };
    };
    const store = fakeStore(start);
    const first = attemptOn(start, 1);
    const { profile: after } = await processActions(input(fakeStore(start), [first]));
    const second = attemptOn(settled(after), 3);
    await processActions(
      input(store, [first, { seq: 2, action: { type: 'finish_turn' } }, second], decide),
    );
    expect(asked).toEqual([2]);
  });

  it("uses the tutor's choice and words, and marks the decision as its own", async () => {
    const profile = started();
    const decide: Decide = async (prepared) => ({
      choice: prepared.candidates[0].id,
      mode: 'llm',
      tutor: { message: 'ข้อความจากคิว', reason: 'เหตุผล', latencyMs: 12 },
    });
    const { turn } = await processActions(
      input(fakeStore(profile), [attemptOn(profile, 1)], decide),
    );
    expect(turn?.mode).toBe('llm');
    expect(turn?.message).toBe('ข้อความจากคิว');
    expect(turn?.reason).toBe('เหตุผล');
    expect(turn?.latencyMs).toBe(12);
  });

  it("falls back to the rules' own line when the tutor has nothing, and logs why", async () => {
    const profile = started();
    const decide: Decide = async () => ({ tutor: { fallbackReason: 'timeout', latencyMs: 4000 } });
    const { turn } = await processActions(
      input(fakeStore(profile), [attemptOn(profile, 1)], decide),
    );
    expect(turn?.mode).toBe('rules');
    expect(turn?.fallbackReason).toBe('timeout');
    expect(turn?.message).toBeTruthy();
  });

  it('never asks the tutor about the control group', async () => {
    const profile = started();
    let asked = false;
    const decide: Decide = async () => {
      asked = true;
      return null;
    };
    await processActions(input(fakeStore(profile, 'fixed'), [attemptOn(profile, 1)], decide));
    expect(asked).toBe(false);
  });

  it('logs a session start, a clip view and a hint', async () => {
    const fresh = newProfile({ id: 'u1', units: [1] });
    const store = fakeStore(fresh);
    await processActions(
      input(store, [
        { seq: 1, action: { type: 'start' } },
        {
          seq: 2,
          action: {
            type: 'scene_view',
            view: {
              template: 'dimension_match',
              purpose: 'intro',
              beatsTotal: 4,
              beatsSeen: 1,
              replays: 0,
              skipped: true,
              durationMs: 300,
            },
          },
        },
        { seq: 3, action: { type: 'finish_scene' } },
        { seq: 4, action: { type: 'hint' } },
      ]),
    );
    expect(store.logs.map(({ kind }) => kind)).toEqual([
      'session',
      'decision',
      'scene_view',
      'hint',
    ]);
  });
});
