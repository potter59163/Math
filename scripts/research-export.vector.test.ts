import { describe, expect, it, vi } from 'vitest';

// Vectors are switched on for this file only, as NEXT_PUBLIC_TOPICS=matrix,vector does on the server.
vi.hoisted(() => {
  process.env.NEXT_PUBLIC_TOPICS = 'matrix,vector';
});

import type { Db } from 'mongodb';
import { CONFIG } from '@/lib/config';
import { restoreAnswer, storeAnswer } from '@/lib/core/answerJson';
import { currentItem, rebuildItem } from '@/lib/director/items';
import { sceneOfChosen, sceneOrNull, workedRequest } from '@/lib/director/scene';
import { newProfile } from '@/lib/director/turn';
import type { Profile } from '@/lib/director/types';
import { createStore } from '@/lib/server/store';
import { processActions, type LearnerRow, type SyncStore } from '@/lib/server/sync';
import { misconceptionAnswer } from '@/lib/sim/answers';
import { applyAction, type LearnerAction } from '@/lib/sync/actions';
import type { QueuedAction } from '@/lib/sync/types';
import type { SceneSpec } from '@/lib/topics/types';
import { researchExport, VECTOR_TEMPLATES } from './research-export.mjs';
import { exportBeforeVectors } from './research-export.frozen.mjs';
import { matrixRef, type Row, type Tables } from './research-export.fixtures';

// One student through the real director and the real /api/sync code, logged by the real store: the rows
// a class leaves once it has started vectors, in the very shapes lib/server/store.ts writes them.

const AT = 1_800_000_000_000;
const STUDENT = 'acct-1';
const DEVICE = 'device-1';

/** Just enough of MongoDB for `writeLogs`: each row it writes lands in `rows`, as it was written. */
function memoryDb() {
  const rows: Tables = {};
  let written = 0;
  const collection = (name: string) => {
    const insert = (row: Row) => {
      written += 1;
      const _id = `${name}-${written}`;
      (rows[name] ??= []).push({ _id, ...row });
      return _id;
    };
    return {
      insertOne: async (row: Row) => ({ insertedId: insert(row) }),
      updateOne: async (_filter: unknown, update: { $setOnInsert: Row }) => ({
        upsertedId: insert(update.$setOnInsert),
      }),
    };
  };
  return { db: { collection } as unknown as Db, rows };
}

/** The server's copy of the student, kept as MongoDB hands it back, and the real store's logging. */
function server(db: Db, profile: Profile) {
  const store = createStore(db);
  let row: LearnerRow = { profile, rev: 0, devices: {}, condition: 'adaptive' };
  const sync: SyncStore = {
    loadLearner: async () => structuredClone(row),
    saveLearner: async (_id, next, expected) => {
      if (row.rev !== expected) return false;
      row = structuredClone({ ...row, ...next, rev: expected + 1 });
      return true;
    },
    writeLogs: (userId, deviceId, logs) => store.writeLogs(userId, deviceId, logs),
  };
  return {
    profile: () => row.profile,
    send: (actions: QueuedAction[]) =>
      processActions({ store: sync, userId: STUDENT, deviceId: DEVICE, actions }),
  };
}

/** The device: what the student does, applied at once as the app does it, and queued for /api/sync. */
function learner(id: string) {
  let profile: Profile = newProfile({ id, units: [1, 2, 3, 4, 5] });
  let seq = 0;
  let clips = 0;
  const queue: QueuedAction[] = [];
  const dispatch = (action: LearnerAction) => {
    seq += 1;
    queue.push({ seq, action });
    profile = applyAction(profile, action).profile;
  };
  /** What SessionScreen sends for a clip watched to the end. */
  const watch = (spec: SceneSpec | null) => {
    if (!spec) return;
    clips += 1;
    dispatch({
      type: 'scene_view',
      view: {
        template: spec.template,
        purpose: spec.purpose,
        beatsTotal: spec.beats.length,
        beatsSeen: spec.beats.length,
        replays: 0,
        skipped: false,
        durationMs: 15_000 + 1_000 * clips,
      },
    });
  };
  return {
    queue,
    profile: () => profile,
    start: () => dispatch({ type: 'start' }),
    /** Each clip of the pending turn as settle() walks it, viewed and then let go, and on. */
    settle() {
      while (profile.pending) {
        const [scene] = profile.pending.turn.scenes;
        if (!scene) {
          dispatch({ type: 'finish_turn' });
          return;
        }
        watch(sceneOfChosen(scene));
        dispatch({ type: 'finish_scene' });
      }
    },
    /** "ดูวิธีทำ" on the answer just sent, which has to be a wrong one. */
    showWorked() {
      const closed = profile.pending?.closed;
      const item = closed && rebuildItem(closed.ref);
      if (!closed || !item || closed.outcome.classification.type === 'correct') {
        throw new Error('no wrong answer to see the solution of');
      }
      const answer = restoreAnswer(closed.answer);
      const request = workedRequest(item, answer, closed.outcome.classification);
      watch(sceneOrNull(request));
      dispatch({ type: 'note_worked', request });
    },
    /** Wrong answers show the item's first misconception, when it has one. */
    answer(wrong: boolean) {
      const item = currentItem(profile);
      if (!item) throw new Error('nothing is open');
      const diagnostic = item.diagnostics[0];
      const answer =
        (wrong && diagnostic && misconceptionAnswer(item, diagnostic.id)) || item.correct;
      const at = AT + seq * 60_000;
      dispatch({
        type: 'attempt',
        ref: item.ref,
        answer: storeAnswer(answer),
        hintLevel: 0,
        timeMs: 20_000 + 1_000 * seq,
        at,
      });
    },
    hint: () => dispatch({ type: 'hint' }),
    learnVectors: () => dispatch({ type: 'set_topic', topic: 'vector' }),
  };
}

/** The class as the export reads it: this student's rows, account, profile and tests. */
function classOf(rows: Tables, profile: Profile): Tables {
  return {
    ...rows,
    profiles: [
      {
        _id: STUDENT,
        display_name: 'ทดลอง',
        condition: 'adaptive',
        consent_at: new Date(AT),
        form_pre: 'A',
        form_post: 'B',
        created_at: new Date(AT),
      },
    ],
    assessments: [
      { _id: 'pre-1', user_id: STUDENT, phase: 'pre', form: 'A', score: 5, total: 14 },
      { _id: 'post-1', user_id: STUDENT, phase: 'post', form: 'B', score: 9, total: 14 },
    ],
    assessment_responses: [
      {
        assessment_id: 'pre-1',
        item_no: 1,
        item_ref: matrixRef('mult', 1, 901),
        correct: false,
        misconception: 'M09_MULT_ELEMENTWISE',
      },
    ],
    learner_profiles: [{ _id: STUDENT, profile }],
  };
}

/** The learner maps in learner_profiles.csv, whose one row is the alias and the quoted profile. */
function mapsIn(file: string | undefined): Row {
  const row = (file ?? '').split('\n')[1];
  const profile = JSON.parse(row.slice(row.indexOf(',') + 2, -1).replaceAll('""', '"')) as Row;
  return { skills: profile.skills, misconceptions: profile.misconceptions };
}

describe('a student who goes on to vectors', () => {
  it('leaves the research files as they were when the student switched', async () => {
    expect(CONFIG.topics).toEqual(['matrix', 'vector']);
    const { db, rows } = memoryDb();
    const student = learner(STUDENT);
    const app = server(db, student.profile());

    /** Answers, opening the solution of the first wrong one, and going on through every clip. */
    const work = (answers: boolean[]) =>
      answers.forEach((wrong, index) => {
        student.answer(wrong);
        if (index === 0) student.showWorked();
        student.settle();
      });

    student.start();
    student.settle();
    work([true, false, true, false, false]);
    student.hint();
    await app.send(student.queue.splice(0));
    const copied = (tables: Tables) =>
      Object.fromEntries(Object.entries(tables).map(([name, list]) => [name, [...list]]));
    const switched = { rows: copied(rows), profile: structuredClone(app.profile()) };

    student.learnVectors();
    student.start();
    student.settle();
    work([true, false, true, false]);
    student.hint();
    await app.send(student.queue.splice(0));
    // The server worked it all out again from the same actions.
    expect(app.profile()).toEqual(student.profile());

    // The vector work is in the database: answers, decisions whose every step is a vector one, clips,
    // a hint, and the vector skills and misconceptions in the one flat profile.
    const isVector = (ref: unknown) => (ref as Row | null)?.topic === 'vector';
    expect(rows.attempts.filter((row) => isVector(row.item_ref))).toHaveLength(4);
    expect(rows.hint_events.filter((row) => isVector(row.item_ref))).toHaveLength(1);
    const vectorDecisions = rows.decisions.slice(switched.rows.decisions.length);
    expect(vectorDecisions).toHaveLength(5);
    for (const { candidates } of vectorDecisions) {
      for (const { next } of candidates as Row[]) expect((next as Row).skill).toMatch(/^v_/);
    }
    // Each clip names the topic it was played in. Both topics' solutions play worked_solution.
    const clipsOf = (views: Row[]) => views.map(({ topic, template }) => [topic, template]);
    const matrixClips = clipsOf(switched.rows.scene_views);
    const vectorClips = clipsOf(rows.scene_views.slice(switched.rows.scene_views.length));
    expect(matrixClips).toContainEqual(['matrix', 'worked_solution']);
    for (const [topic] of matrixClips) expect(topic).toBe('matrix');
    expect(vectorClips).toContainEqual(['vector', 'worked_solution']);
    for (const [topic, template] of vectorClips) {
      expect(topic).toBe('vector');
      expect([...VECTOR_TEMPLATES, 'worked_solution']).toContain(template);
    }
    const profile = app.profile();
    expect(Object.keys(profile.skills).filter((id) => id.startsWith('v_'))).not.toEqual([]);
    expect(Object.keys(profile.misconceptions).filter((id) => /^V\d\d_/.test(id))).not.toEqual([]);

    const atSwitch = classOf(switched.rows, switched.profile);
    const now = classOf(rows, profile);
    const before = researchExport(atSwitch).files;
    const after = researchExport(now).files;
    for (const name of [
      'attempts.csv',
      'decisions.csv',
      'scene_views.csv',
      'hint_events.csv',
      'assessments.csv',
      'assessment_responses.csv',
      'research_wide.csv',
    ]) {
      expect([name, after.get(name)]).toEqual([name, before.get(name)]);
    }
    // The running totals (xp, itemsDone) went on with the vector work, but the maps did not.
    expect(mapsIn(after.get('learner_profiles.csv'))).toEqual(
      mapsIn(before.get('learner_profiles.csv')),
    );
    // The export before vectors would have counted the vector clips as matrix ones.
    for (const name of ['scene_views.csv', 'research_wide.csv']) {
      expect([name, exportBeforeVectors(now).files.get(name)]).not.toEqual([
        name,
        exportBeforeVectors(atSwitch).files.get(name),
      ]);
    }
  });
});
