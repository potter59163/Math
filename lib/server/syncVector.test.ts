import { describe, expect, it, vi } from 'vitest';

// Vectors are switched on for this file only, as NEXT_PUBLIC_TOPICS=matrix,vector does on the server.
vi.hoisted(() => {
  process.env.NEXT_PUBLIC_TOPICS = 'matrix,vector';
});

import { restoreAnswer, storeAnswer } from '@/lib/core/answerJson';
import { Surd } from '@/lib/core/surd';
import type { Answer } from '@/lib/core/types';
import { currentItem, rebuildItem } from '@/lib/director/items';
import { startSession } from '@/lib/director/rules';
import { finishScene, newProfile } from '@/lib/director/turn';
import type { Profile } from '@/lib/director/types';
import { misconceptionAnswer } from '@/lib/sim/answers';
import type { QueuedAction } from '@/lib/sync/types';
import type { VectorItem } from '@/lib/topics/vector/types';
import { syncRequest } from './schemas';
import { processActions, type LearnerRow, type LogEntry, type SyncStore } from './sync';

// A vector answer goes to the server as JSON, is rebuilt and classified again there, and the profile
// that comes back holds it in a form a device can restore (docs/VECTORS.md §6.2).

const AT = 1_800_000_000_000;

function settled(profile: Profile): Profile {
  let p = profile;
  while (p.pending) p = finishScene(p);
  return p;
}

/** Keeps the row as JSON, the way MongoDB hands it back, so anything not plain data is caught. */
function jsonStore(profile: Profile) {
  let row: LearnerRow = JSON.parse(
    JSON.stringify({ profile, rev: 0, devices: {}, condition: 'adaptive' }),
  ) as LearnerRow;
  const logs: LogEntry[] = [];
  const store: SyncStore = {
    loadLearner: async () => JSON.parse(JSON.stringify(row)) as LearnerRow,
    saveLearner: async (_id, next, expected) => {
      if (row.rev !== expected) return false;
      row = JSON.parse(JSON.stringify({ ...row, ...next, rev: expected + 1 })) as LearnerRow;
      return true;
    },
    writeLogs: async (_id, _device, entries) => {
      logs.push(...entries);
    },
  };
  return { store, logs, row: () => row };
}

const started = () =>
  settled(startSession(newProfile({ id: 'v1', units: [1, 2, 3, 4, 5], activeTopic: 'vector' })));

function request(actions: QueuedAction['action'][]) {
  return {
    deviceId: 'c0a8012e-7f4b-4c1d-9a55-0e9d6f3a1b2c',
    actions: actions.map((action, index) => ({ seq: index + 1, action })),
  };
}

describe('a vector attempt through the server', () => {
  it('is checked, regenerated, classified again, stored and restored', async () => {
    const profile = started();
    const item = currentItem(profile) as VectorItem;
    expect(item.ref.topic).toBe('vector');

    // A wrong answer the catalog knows, or else one plainly wrong, sent as the device would send it.
    const diagnostic = item.diagnostics[0];
    const answer = (diagnostic && misconceptionAnswer(item, diagnostic.id)) ?? {
      kind: 'choice' as const,
      id: 'none',
    };
    const body = JSON.parse(
      JSON.stringify(
        request([
          {
            type: 'attempt',
            ref: item.ref,
            answer: storeAnswer(answer),
            hintLevel: 0,
            timeMs: 9000,
            at: AT,
          },
        ]),
      ),
    );
    const parsed = syncRequest.safeParse(body);
    expect(parsed.success).toBe(true);

    const { store, logs, row } = jsonStore(profile);
    await processActions({
      store,
      userId: 'v1',
      deviceId: body.deviceId,
      actions: parsed.data!.actions as QueuedAction[],
      decide: null,
    });

    const [logged] = logs;
    if (logged?.kind !== 'attempt') throw new Error('expected an attempt log');
    expect(logged.item).toEqual(item);
    expect(logged.outcome.classification.type).not.toBe('correct');
    if (diagnostic) {
      expect(logged.outcome.classification).toMatchObject({
        type: 'misconception',
        id: diagnostic.id,
      });
    }

    const closed = row().profile.pending?.closed;
    expect(closed).toBeDefined();
    expect(rebuildItem(closed!.ref)).toEqual(item);
    expect(restoreAnswer(closed!.answer)).toEqual(answer);
  });

  it('stores a √ answer and gives back the same value', async () => {
    const profile = started();
    const answer = {
      kind: 'vector',
      value: [Surd.parse('1/2√2'), Surd.parse('-3√5'), Surd.ZERO],
    } satisfies Answer;
    const item = currentItem(profile) as VectorItem;
    const { store, row } = jsonStore(profile);
    await processActions({
      store,
      userId: 'v1',
      deviceId: 'device-a',
      actions: [
        {
          seq: 1,
          action: {
            type: 'attempt',
            ref: item.ref,
            answer: storeAnswer(answer),
            hintLevel: 0,
            timeMs: 9000,
            at: AT,
          },
        },
      ],
      decide: null,
    });
    const restored = restoreAnswer(row().profile.pending!.closed!.answer);
    expect(restored.kind).toBe('vector');
    if (restored.kind !== 'vector') return;
    restored.value.forEach((part, i) => expect(part.equals(answer.value[i])).toBe(true));
  });

  it('never trusts a forged item: the server builds it from the ref alone', async () => {
    const profile = started();
    const item = currentItem(profile) as VectorItem;
    const { store, logs } = jsonStore(profile);
    await processActions({
      store,
      userId: 'v1',
      deviceId: 'device-a',
      actions: [
        {
          seq: 1,
          action: {
            type: 'attempt',
            ref: item.ref,
            answer: storeAnswer(item.correct),
            hintLevel: 0,
            timeMs: 9000,
            at: AT,
          },
        },
      ],
      decide: null,
    });
    const [logged] = logs;
    if (logged?.kind !== 'attempt') throw new Error('expected an attempt log');
    expect(logged.outcome.classification).toEqual({ type: 'correct' });
    expect(logged.item.correct).toEqual(item.correct);
  });

  it('takes a batch that mixes both topics', () => {
    const matrix = settled(startSession(newProfile({ id: 'm1', units: [1, 2, 3, 4, 5] })));
    const matrixItem = currentItem(matrix)!;
    const vectorItem = currentItem(started())!;
    const attempt = (ref: typeof matrixItem.ref, answer: Parameters<typeof storeAnswer>[0]) => ({
      type: 'attempt' as const,
      ref,
      answer: storeAnswer(answer),
      hintLevel: 0 as const,
      timeMs: 1000,
      at: AT,
    });
    const body = JSON.parse(
      JSON.stringify(
        request([
          attempt(matrixItem.ref, matrixItem.correct),
          { type: 'set_topic', topic: 'vector' },
          attempt(vectorItem.ref, vectorItem.correct),
        ]),
      ),
    );
    expect(syncRequest.safeParse(body).success).toBe(true);
  });
});
