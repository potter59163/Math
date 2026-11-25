import { describe, expect, it, vi } from 'vitest';

// Vectors are switched on for this file only, as NEXT_PUBLIC_TOPICS=matrix,vector does on the server.
vi.hoisted(() => {
  process.env.NEXT_PUBLIC_TOPICS = 'matrix,vector';
});

import type { Db } from 'mongodb';
import { CONFIG } from '@/lib/config';
import { storeAnswer } from '@/lib/core/answerJson';
import { currentItem } from '@/lib/director/items';
import { startSession, submitAttempt } from '@/lib/director/rules';
import { newProfile } from '@/lib/director/turn';
import type { Profile } from '@/lib/director/types';
import { createStore } from '@/lib/server/store';
import type { LogEntry } from '@/lib/server/sync';
import { misconceptionAnswer } from '@/lib/sim/answers';
import { settle } from '@/lib/sim/drive';
import { applyAction } from '@/lib/sync/actions';
import { researchExport } from './research-export.mjs';
import { matrixRef, type Row, type Tables } from './research-export.fixtures';

// One student through the real director, logged by the real store: the rows a class leaves once it has
// started vectors, in the very shapes lib/server/store.ts writes them.

const AT = 1_800_000_000_000;
const STUDENT = 'acct-1';

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

/** What /api/sync would log as this student starts, answers and asks for a hint. */
function learner(id: string) {
  let profile: Profile = newProfile({ id, units: [1, 2, 3, 4, 5] });
  let seq = 0;
  const logs: LogEntry[] = [];
  return {
    logs,
    profile: () => profile,
    start() {
      profile = startSession(profile);
      const turn = profile.pending?.turn;
      logs.push({ kind: 'session' }, ...(turn ? [{ kind: 'decision' as const, turn }] : []));
      profile = settle(profile);
    },
    /** Wrong answers show the item's first misconception, when it has one. */
    answer(wrong: boolean) {
      const item = currentItem(profile);
      if (!item) throw new Error('nothing is open');
      const diagnostic = item.diagnostics[0];
      const answer =
        (wrong && diagnostic && misconceptionAnswer(item, diagnostic.id)) || item.correct;
      seq += 1;
      const at = AT + seq * 60_000;
      const timeMs = 20_000 + 1_000 * seq;
      const result = submitAttempt(profile, { item, answer, hintLevel: 0, timeMs, at });
      logs.push({
        kind: 'attempt',
        seq,
        item,
        action: {
          type: 'attempt',
          ref: item.ref,
          answer: storeAnswer(answer),
          hintLevel: 0,
          timeMs,
          at,
        },
        outcome: result.outcome,
        turn: result.turn,
      });
      profile = settle(result.profile);
    },
    hint() {
      logs.push({ kind: 'hint', itemRef: currentItem(profile)?.ref ?? null, level: 1 });
    },
    learnVectors() {
      profile = applyAction(profile, { type: 'set_topic', topic: 'vector' }).profile;
    },
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
    const store = createStore(db);
    const student = learner(STUDENT);

    student.start();
    for (const wrong of [true, false, true, false, false]) student.answer(wrong);
    student.hint();
    await store.writeLogs(STUDENT, 'device-1', student.logs.splice(0));
    const copied = (tables: Tables) =>
      Object.fromEntries(Object.entries(tables).map(([name, list]) => [name, [...list]]));
    const switched = { rows: copied(rows), profile: structuredClone(student.profile()) };

    student.learnVectors();
    student.start();
    for (const wrong of [true, false, true, false]) student.answer(wrong);
    student.hint();
    await store.writeLogs(STUDENT, 'device-1', student.logs.splice(0));

    // The vector work is in the database: answers, decisions whose every step is a vector one, a hint,
    // and the vector skills and misconceptions in the one flat profile.
    const isVector = (ref: unknown) => (ref as Row | null)?.topic === 'vector';
    expect(rows.attempts.filter((row) => isVector(row.item_ref))).toHaveLength(4);
    expect(rows.hint_events.filter((row) => isVector(row.item_ref))).toHaveLength(1);
    const vectorDecisions = rows.decisions.slice(switched.rows.decisions.length);
    expect(vectorDecisions).toHaveLength(5);
    for (const { candidates } of vectorDecisions) {
      for (const { next } of candidates as Row[]) expect((next as Row).skill).toMatch(/^v_/);
    }
    expect(Object.keys(student.profile().skills).filter((id) => id.startsWith('v_'))).not.toEqual(
      [],
    );
    expect(
      Object.keys(student.profile().misconceptions).filter((id) => /^V\d\d_/.test(id)),
    ).not.toEqual([]);

    const before = researchExport(classOf(switched.rows, switched.profile)).files;
    const after = researchExport(classOf(rows, student.profile())).files;
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
  });
});
