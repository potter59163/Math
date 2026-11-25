import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { restoreAnswer, storeAnswer } from '@/lib/core/answerJson';
import { currentItem, rebuildItem } from '@/lib/director/items';
import { startSession } from '@/lib/director/rules';
import { sceneOfChosen, sceneOrNull, workedRequest } from '@/lib/director/scene';
import { finishScene, newProfile } from '@/lib/director/turn';
import type { Condition, Profile } from '@/lib/director/types';
import { misconceptionAnswer, slipAnswer } from '@/lib/sim/answers';
import { applyAction, type LearnerAction } from '@/lib/sync/actions';
import type { QueuedAction } from '@/lib/sync/types';
import type { SceneSpec } from '@/lib/topics/types';
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

type Move = 'right' | 'wrong' | 'worked' | 'hint' | 'help';

/**
 * What a device sends as a student goes through a session the way SessionScreen takes them: every clip
 * the director plays is viewed and then let go, and "ดูวิธีทำ" opens the solution after a wrong answer.
 */
function sessionOf(units: number[], moves: readonly Move[]): QueuedAction[] {
  let profile = newProfile({ id: 'u1', units });
  const actions: QueuedAction[] = [];
  const send = (action: LearnerAction) => {
    actions.push({ seq: actions.length + 1, action });
    const result = applyAction(profile, action);
    profile = result.profile;
    return result;
  };
  const watch = (spec: SceneSpec | null) => {
    if (!spec) return;
    const view = {
      template: spec.template,
      purpose: spec.purpose,
      beatsTotal: spec.beats.length,
      beatsSeen: (actions.length % spec.beats.length) + 1,
      replays: actions.length % 2,
      skipped: actions.length % 3 === 0,
      durationMs: 1_000 * actions.length,
    };
    send({ type: 'scene_view', view });
  };
  const goOn = () => {
    while (profile.pending) {
      const [scene] = profile.pending.turn.scenes;
      if (!scene) {
        send({ type: 'finish_turn' });
        return;
      }
      watch(sceneOfChosen(scene));
      send({ type: 'finish_scene' });
    }
  };

  send({ type: 'start' });
  goOn();
  let helps = 0;
  for (const move of moves) {
    const item = currentItem(profile);
    if (!item) break;
    if (move === 'hint') {
      send({ type: 'hint' });
    } else if (move === 'help') {
      const [scene] = send({ type: 'help', ref: item.ref, nth: helps++ }).turn?.scenes ?? [];
      watch(scene ? sceneOrNull(scene.request) : null);
    } else {
      const diagnostic = item.diagnostics[0];
      const answer =
        move === 'right'
          ? item.correct
          : ((diagnostic && misconceptionAnswer(item, diagnostic.id)) ?? slipAnswer(item));
      const at = AT + actions.length;
      const hintLevel = profile.current?.hintLevel ?? 0;
      send({
        type: 'attempt',
        ref: item.ref,
        answer: storeAnswer(answer),
        hintLevel,
        timeMs: 9,
        at,
      });
      const closed = profile.pending?.closed;
      const closedItem = closed && rebuildItem(closed.ref);
      // The button is there after a wrong answer only.
      const wrong = closed && closed.outcome.classification.type !== 'correct';
      if (move === 'worked' && closed && closedItem && wrong) {
        const { classification } = closed.outcome;
        const request = workedRequest(closedItem, restoreAnswer(closed.answer), classification);
        watch(sceneOrNull(request));
        send({ type: 'note_worked', request });
      }
      goOn();
    }
  }
  return actions;
}

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

describe('a clip view', () => {
  const move = fc.constantFrom<Move>('right', 'wrong', 'worked', 'hint', 'help');

  it('is logged as it always was, now naming matrices, whatever a matrix student does', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.subarray([1, 2, 3, 4, 5], { minLength: 1 }),
        fc.array(move, { maxLength: 8 }),
        async (units, moves) => {
          const actions = sessionOf(units, moves);
          const viewed = fakeStore(newProfile({ id: 'u1', units }));
          await processActions(input(viewed, actions));
          const unviewed = fakeStore(newProfile({ id: 'u1', units }));
          const others = actions.filter(({ action }) => action.type !== 'scene_view');
          await processActions(input(unviewed, others));

          // The entry a view always made, { kind, view }, with the topic the student is on.
          expect(viewed.logs.filter(({ kind }) => kind === 'scene_view')).toEqual(
            actions.flatMap(({ action }) =>
              action.type === 'scene_view'
                ? [{ kind: 'scene_view', view: action.view, topic: 'matrix' }]
                : [],
            ),
          );
          // And a view still changes nothing else, in the log or in the student.
          expect(viewed.logs.filter(({ kind }) => kind !== 'scene_view')).toEqual(unviewed.logs);
          expect(viewed.row?.profile).toEqual(unviewed.row?.profile);
        },
      ),
    );
  });
});
