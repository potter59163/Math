import { randomUUID } from 'node:crypto';
import { MongoClient, MongoServerError, type Db } from 'mongodb';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { storeAnswer } from '@/lib/core/answerJson';
import { currentItem } from '@/lib/director/items';
import { startSession } from '@/lib/director/rules';
import { finishScene, newProfile } from '@/lib/director/turn';
import type { Profile } from '@/lib/director/types';
import type { Account, QueuedAction } from '@/lib/sync/types';
import type { MatrixItem } from '@/lib/topics/matrix/types';
import { createAuthStore, SESSION_MAX_AGE_S } from './authStore';
import { createStore, ensureIndexes, type AppStore, type AssessmentResponseRow } from './store';
import { processActions, type LogEntry } from './sync';

// What matters here is how the database itself behaves: unique indexes, upserts, the rev check. So this
// runs against a real one, and is skipped unless TEST_MONGODB_URI is set (docs/SETUP.md). Each run makes a
// database of its own and drops it, so it cannot touch anything real.

const uri = process.env.TEST_MONGODB_URI;

const AT = 1_800_000_000_000;
const ACCOUNT: Account = {
  displayName: 'ทดสอบ',
  avatar: 'pi',
  showOnLeaderboard: true,
  condition: 'adaptive',
};
const CONSENT = '2026-11-13T02:00:00.000Z';

function settled(profile: Profile): Profile {
  let p = profile;
  while (p.pending) p = finishScene(p);
  return p;
}

const started = (id: string) => settled(startSession(newProfile({ id, units: [1, 2, 3, 4, 5] })));

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

const RESPONSES: AssessmentResponseRow[] = [
  {
    item_no: 1,
    item_ref: { skill: 'dim' },
    answer: { kind: 'undefined' },
    correct: true,
    misconception: null,
    variant: null,
    time_ms: 900,
  },
  {
    item_no: 2,
    item_ref: { skill: 'mult' },
    answer: null,
    correct: false,
    misconception: 'M09_MULT_ELEMENTWISE',
    variant: null,
    time_ms: null,
  },
];

describe.skipIf(!uri)('on a real MongoDB', () => {
  let client: MongoClient;
  let db: Db;
  let store: AppStore;

  beforeAll(async () => {
    client = new MongoClient(uri!, { ignoreUndefined: true });
    db = client.db(`kidma_test_${randomUUID().slice(0, 8)}`);
    await ensureIndexes(db);
    store = createStore(db);
    // On a free Atlas cluster the very first ensureIndexes takes about 8 s.
  }, 60_000);

  afterAll(async () => {
    await db?.dropDatabase();
    await client?.close();
  });

  async function student(account: Account = ACCOUNT, cohort?: string) {
    const id = randomUUID();
    const profile = started(id);
    await store.createAccount(id, { account, cohort, profile, consentAt: CONSENT });
    return { id, profile };
  }

  const countOf = (name: string, id: string) => db.collection(name).countDocuments({ user_id: id });

  describe('indexes', () => {
    it('can be asked for again, as every new server process does', async () => {
      await expect(ensureIndexes(db)).resolves.toBeUndefined();
    });

    it('have MongoDB remove expired sessions by itself', async () => {
      const indexes = await db.collection('auth_sessions').indexes();
      expect(indexes.find(({ name }) => name === 'expires_at_1')?.expireAfterSeconds).toBe(0);
    });
  });

  describe('accounts', () => {
    it('has none until consent is recorded', async () => {
      const id = randomUUID();
      expect(await store.loadAccount(id)).toBeNull();
      expect(await store.loadLearner(id)).toBeNull();
      await db.collection<{ _id: string }>('profiles').insertOne({ _id: id });
      expect(await store.loadAccount(id)).toBeNull();
    });

    it('keeps what the student chose, and the group from their link', async () => {
      const { id } = await student(ACCOUNT, 'm5-1');
      expect(await store.loadAccount(id)).toEqual(ACCOUNT);
      const row = await db
        .collection<{ _id: string; created_at?: Date }>('profiles')
        .findOne({ _id: id });
      expect(row).toMatchObject({ cohort: 'm5-1', consent_at: new Date(CONSENT) });
      expect(row?.created_at).toBeInstanceOf(Date);
    });

    it('changes only what was asked', async () => {
      const { id } = await student();
      await store.updateAccount(id, { displayName: 'ชื่อใหม่' });
      await store.updateAccount(id, { showOnLeaderboard: false });
      expect(await store.loadAccount(id)).toEqual({
        ...ACCOUNT,
        displayName: 'ชื่อใหม่',
        showOnLeaderboard: false,
      });
    });
  });

  describe('a student', () => {
    it('comes back exactly as saved, with the group they are in', async () => {
      const { id, profile } = await student({ ...ACCOUNT, condition: 'fixed' });
      const row = await store.loadLearner(id);
      expect(row).toMatchObject({ rev: 0, devices: {}, condition: 'fixed' });
      expect(row?.profile).toEqual(profile);
    });

    it('is not wiped by finishing the welcome screen twice', async () => {
      const { id, profile } = await student();
      const moved = { ...profile, xp: 40 };
      expect(await store.saveLearner(id, { profile: moved, devices: { a: 1 } }, 0)).toBe(true);
      await store.createAccount(id, { account: ACCOUNT, profile, consentAt: CONSENT });
      expect(await store.loadLearner(id)).toMatchObject({
        rev: 1,
        devices: { a: 1 },
        profile: { xp: 40 },
      });
    });

    it('cannot be saved over by someone who read an older copy', async () => {
      const { id, profile } = await student();
      const save = (xp: number, rev: number) =>
        store.saveLearner(id, { profile: { ...profile, xp }, devices: {} }, rev);
      expect(await save(10, 0)).toBe(true);
      expect(await save(99, 0)).toBe(false);
      expect((await store.loadLearner(id))?.profile.xp).toBe(10);
      expect(await save(20, 1)).toBe(true);
      expect((await store.loadLearner(id))?.rev).toBe(2);
    });
  });

  describe('answers', () => {
    it('logs an answer with its decision, and a retry pays and logs nothing more', async () => {
      const { id, profile } = await student();
      const input = {
        store,
        userId: id,
        deviceId: 'device-a',
        actions: [attemptOn(profile, 1)],
      };
      expect((await processActions(input)).profile.xp).toBe(10);
      expect((await processActions(input)).profile.xp).toBe(10);
      expect(await countOf('attempts', id)).toBe(1);
      expect(await countOf('decisions', id)).toBe(1);

      const attempt = await db.collection('attempts').findOne({ user_id: id });
      const decision = await db.collection('decisions').findOne({ user_id: id });
      expect(attempt).toMatchObject({ device_id: 'device-a', seq: 1, xp: 10 });
      expect(attempt?.created_at).toBeInstanceOf(Date);
      expect(decision?.attempt_id).toEqual(attempt?._id);
      expect((await store.loadLearner(id))?.devices).toEqual({ 'device-a': 1 });
    });

    it('never logs one twice, even if the same log is written again', async () => {
      const { id, profile } = await student();
      const seen: LogEntry[] = [];
      await processActions({
        store: {
          ...store,
          writeLogs: async (user, device, logs) => {
            seen.push(...logs);
            await store.writeLogs(user, device, logs);
          },
        },
        userId: id,
        deviceId: 'device-a',
        actions: [attemptOn(profile, 1)],
      });
      await store.writeLogs(id, 'device-a', seen);
      expect(await countOf('attempts', id)).toBe(1);
      expect(await countOf('decisions', id)).toBe(1);
    });

    it('takes two phones answering at once, and loses neither', async () => {
      const { id, profile } = await student();
      const answer = [attemptOn(profile, 1)];
      await Promise.all(
        ['device-a', 'device-b'].map((deviceId) =>
          processActions({ store, userId: id, deviceId, actions: answer }),
        ),
      );
      const row = await store.loadLearner(id);
      expect(row?.devices).toEqual({ 'device-a': 1, 'device-b': 1 });
      expect(row?.rev).toBe(2);
      expect(await countOf('attempts', id)).toBe(2);
    });

    it('counts only what is inside the window', async () => {
      const { id, profile } = await student();
      await processActions({
        store,
        userId: id,
        deviceId: 'device-a',
        actions: [attemptOn(profile, 1)],
      });
      const ago = (ms: number) => new Date(Date.now() - ms).toISOString();
      expect(await store.attemptsSince(id, ago(60_000))).toBe(1);
      expect(await store.attemptsSince(id, ago(-60_000))).toBe(0);
      expect(await store.llmCallsSince(id, ago(60_000))).toBe(0);
      await db
        .collection('decisions')
        .insertOne({ user_id: id, mode: 'llm', created_at: new Date() });
      expect(await store.llmCallsSince(id, ago(60_000))).toBe(1);
    });
  });

  describe('tests', () => {
    const taken = { phase: 'pre', form: 'A', score: 1, total: 2, startedAt: AT } as const;

    it('gives each student one try at each', async () => {
      const { id } = await student();
      expect(await store.assessmentScores(id)).toEqual({ pre: null, post: null });
      expect(await store.saveAssessment(id, { ...taken, responses: RESPONSES })).toBe(true);
      expect(await store.saveAssessment(id, { ...taken, score: 2, responses: RESPONSES })).toBe(
        false,
      );
      expect(await store.assessmentScores(id)).toEqual({
        pre: { score: 1, total: 2 },
        post: null,
      });
      expect(
        await store.saveAssessment(id, {
          ...taken,
          phase: 'post',
          form: 'B',
          responses: RESPONSES,
        }),
      ).toBe(true);

      const row = await db.collection<{ _id: string }>('profiles').findOne({ _id: id });
      expect(row).toMatchObject({ form_pre: 'A', form_post: 'B' });
    });

    it('keeps every answer under its test, and no copies', async () => {
      const { id } = await student();
      await store.saveAssessment(id, { ...taken, responses: RESPONSES });
      const assessment = await db.collection('assessments').findOne({ user_id: id });
      expect(assessment).toMatchObject({ phase: 'pre', form: 'A', started_at: new Date(AT) });
      expect(assessment?.submitted_at).toBeInstanceOf(Date);

      const responses = db.collection('assessment_responses');
      const rows = await responses.find({ assessment_id: assessment?._id }).toArray();
      expect(rows.map(({ item_no }) => item_no).sort()).toEqual([1, 2]);
      await expect(
        responses.insertOne({ assessment_id: assessment?._id, item_no: 1 }),
      ).rejects.toBeInstanceOf(MongoServerError);
    });
  });

  describe('the leaderboard', () => {
    // A week of its own, far from every other test's answers.
    const WEEK = '2099-01-05T17:00:00.000Z';
    const inWeek = new Date('2099-01-06T00:00:00.000Z');
    const before = new Date('2099-01-01T00:00:00.000Z');
    let seq = 0;

    const earned = (id: string, xp: number, createdAt = inWeek) =>
      db.collection('attempts').insertOne({
        user_id: id,
        device_id: 'device-a',
        seq: (seq += 1),
        xp,
        created_at: createdAt,
      });

    it('adds up the week, leaves out those who left it, and says nothing but name and XP', async () => {
      const first = await student({ ...ACCOUNT, displayName: 'หนึ่ง' });
      const second = await student({ ...ACCOUNT, displayName: 'สอง', avatar: 'sigma' });
      const hidden = await student({ ...ACCOUNT, showOnLeaderboard: false });
      const lastWeek = await student();
      const noXp = await student();
      await earned(first.id, 20);
      await earned(first.id, 15);
      await earned(second.id, 10);
      await earned(hidden.id, 99);
      await earned(lastWeek.id, 50, before);
      await earned(noXp.id, 0);

      expect(await store.weeklyLeaderboard(WEEK, 10)).toEqual([
        { user_id: first.id, display_name: 'หนึ่ง', avatar: 'pi', xp: 35 },
        { user_id: second.id, display_name: 'สอง', avatar: 'sigma', xp: 10 },
      ]);
      expect(await store.weeklyLeaderboard(WEEK, 1)).toHaveLength(1);
    });
  });

  describe('deleting an account', () => {
    const EVERYWHERE = [
      'attempts',
      'decisions',
      'sessions',
      'scene_views',
      'hint_events',
      'assessments',
    ];

    async function studentWithEverything(sub: string) {
      const auth = createAuthStore(db);
      const id = await auth.userIdFor(sub);
      const profile = started(id);
      await store.createAccount(id, { account: ACCOUNT, profile, consentAt: CONSENT });
      await processActions({
        store,
        userId: id,
        deviceId: 'device-a',
        actions: [attemptOn(profile, 1)],
      });
      await store.writeLogs(id, 'device-a', [
        { kind: 'session' },
        { kind: 'hint', itemRef: null, level: 1 },
        {
          kind: 'scene_view',
          view: {
            template: 'cell_by_cell',
            purpose: 'intro',
            beatsTotal: 1,
            beatsSeen: 1,
            replays: 0,
            skipped: false,
            durationMs: 1,
          },
        },
      ]);
      await store.saveAssessment(id, {
        phase: 'pre',
        form: 'A',
        score: 1,
        total: 2,
        startedAt: AT,
        responses: RESPONSES,
      });
      const token = await auth.startSession(id);
      return { id, token, auth };
    }

    it('leaves nothing about the student in any collection, and everyone else untouched', async () => {
      const { id, token, auth } = await studentWithEverything('google-to-delete');
      const other = await studentWithEverything('google-who-stays');

      for (const name of EVERYWHERE) expect(await countOf(name, id), name).toBeGreaterThan(0);
      const assessment = await db.collection('assessments').findOne({ user_id: id });
      const responsesOf = (assessmentId: unknown) =>
        db.collection('assessment_responses').countDocuments({ assessment_id: assessmentId });
      expect(await responsesOf(assessment?._id)).toBe(2);

      await store.deleteAccount(id);

      // Every collection there is, so a new one cannot be forgotten here.
      const collections = await db.listCollections().toArray();
      expect(collections.length).toBeGreaterThanOrEqual(11);
      for (const { name } of collections) {
        const left = await db
          .collection<{ _id: string; user_id?: string }>(name)
          .countDocuments({ $or: [{ _id: id }, { user_id: id }] });
        expect(left, name).toBe(0);
      }
      expect(await responsesOf(assessment?._id)).toBe(0);
      expect(await auth.userOfSession(token)).toBeNull();

      for (const name of EVERYWHERE) expect(await countOf(name, other.id), name).toBeGreaterThan(0);
      expect(await other.auth.userOfSession(other.token)).toBe(other.id);
      expect(await store.loadAccount(other.id)).toEqual(ACCOUNT);
    });

    it('makes a new student of whoever signs in with that Google account again', async () => {
      const { id, auth } = await studentWithEverything('google-comes-back');
      await store.deleteAccount(id);
      const again = await auth.userIdFor('google-comes-back');
      expect(again).not.toBe(id);
      expect(await store.loadAccount(again)).toBeNull();
    });

    it('finishes the job if asked twice', async () => {
      const { id } = await studentWithEverything('google-twice');
      await store.deleteAccount(id);
      await expect(store.deleteAccount(id)).resolves.toBeUndefined();
    });
  });

  describe('signing in', () => {
    it('makes one student of a Google account, however many sign in at once', async () => {
      const auth = createAuthStore(db);
      const ids = await Promise.all(
        Array.from({ length: 8 }, () => auth.userIdFor('google-at-once')),
      );
      expect(new Set(ids).size).toBe(1);
      expect(await db.collection('users').countDocuments({ google_sub: 'google-at-once' })).toBe(1);
      expect(await auth.userIdFor('google-someone-else')).not.toBe(ids[0]);
    });

    it('knows a session by its token, and keeps only a hash of it', async () => {
      const auth = createAuthStore(db);
      const token = await auth.startSession('student-1');
      expect(await auth.userOfSession(token)).toBe('student-1');
      expect(await auth.userOfSession('some-other-token')).toBeNull();

      const stored = await db.collection('auth_sessions').find({ user_id: 'student-1' }).toArray();
      expect(stored).toHaveLength(1);
      expect(JSON.stringify(stored)).not.toContain(token);
    });

    it('ends a session on this device alone', async () => {
      const auth = createAuthStore(db);
      const phone = await auth.startSession('student-2');
      const laptop = await auth.startSession('student-2');
      await auth.endSession(phone);
      expect(await auth.userOfSession(phone)).toBeNull();
      expect(await auth.userOfSession(laptop)).toBe('student-2');
    });

    it('lets a session run out after its time, even before MongoDB sweeps it away', async () => {
      const startedAt = Date.now();
      const token = await createAuthStore(db, () => startedAt).startSession('student-3');
      const later = (ms: number) => createAuthStore(db, () => startedAt + ms);
      expect(await later(SESSION_MAX_AGE_S * 1000 - 1000).userOfSession(token)).toBe('student-3');
      expect(await later(SESSION_MAX_AGE_S * 1000 + 1000).userOfSession(token)).toBeNull();
    });
  });
});
