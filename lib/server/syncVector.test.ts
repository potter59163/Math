import fc from 'fast-check';
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
import type { TemplateId } from '@/lib/topics';
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

describe('a clip view through the server', () => {
  const view = (template: TemplateId, purpose: 'intro' | 'remediate' | 'reveal' = 'reveal') => ({
    type: 'scene_view' as const,
    view: {
      template,
      purpose,
      beatsTotal: 4,
      beatsSeen: 4,
      replays: 0,
      skipped: false,
      durationMs: 12_000,
    },
  });

  it('names the topic the student is on, which only set_topic changes', async () => {
    const profile = settled(startSession(newProfile({ id: 'm1', units: [1, 2, 3, 4, 5] })));
    const { store, logs } = jsonStore(profile);
    const actions: QueuedAction['action'][] = [
      view('worked_solution'),
      { type: 'set_topic', topic: 'vector' },
      view('quantity_sort', 'intro'),
      // A vector solution plays the template matrices use too: only the topic tells them apart.
      view('worked_solution'),
      { type: 'set_topic', topic: 'matrix' },
      view('cell_by_cell', 'remediate'),
    ];
    await processActions({
      store,
      userId: 'm1',
      deviceId: 'device-a',
      actions: actions.map((action, index) => ({ seq: index + 1, action })),
      decide: null,
    });
    expect(
      logs.flatMap((entry) =>
        entry.kind === 'scene_view' ? [[entry.view.template, entry.topic]] : [],
      ),
    ).toEqual([
      ['worked_solution', 'matrix'],
      ['quantity_sort', 'vector'],
      ['worked_solution', 'vector'],
      ['cell_by_cell', 'matrix'],
    ]);
  });

  it('names matrices for every student who has not gone on to vectors', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.subarray([1, 2, 3, 4, 5], { minLength: 1 }),
        fc.constantFrom(undefined, 'matrix' as const),
        fc.constantFrom<TemplateId>('dimension_match', 'cell_by_cell', 'sarrus', 'worked_solution'),
        async (units, activeTopic, template) => {
          const student = { id: 'm1', units, ...(activeTopic && { activeTopic }) };
          const { store, logs } = jsonStore(newProfile(student));
          const seen = view(template);
          await processActions({
            store,
            userId: 'm1',
            deviceId: 'device-a',
            actions: [
              { seq: 1, action: { type: 'start' } },
              { seq: 2, action: seen },
            ],
            decide: null,
          });
          expect(logs.filter(({ kind }) => kind === 'scene_view')).toEqual([
            { kind: 'scene_view', view: seen.view, topic: 'matrix' },
          ]);
        },
      ),
    );
  });
});
