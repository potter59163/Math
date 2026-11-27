import { randomUUID } from 'node:crypto';
import { MongoClient, MongoServerError, type Db } from 'mongodb';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { storeAnswer } from '@/lib/core/answerJson';
import { currentItem, rebuildItem } from '@/lib/director/items';
import { startSession } from '@/lib/director/rules';
import { finishScene, newProfile } from '@/lib/director/turn';
import type { Profile } from '@/lib/director/types';
import type { Account, QueuedAction } from '@/lib/sync/types';
import type { MatrixItem } from '@/lib/topics/matrix/types';
import { createAuthStore, SESSION_MAX_AGE_S } from './authStore';
import { PHOTO_KEY } from './photo';
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

  /** The key a student's photo is asked for by, which no route ever gives to its owner by name. */
  const photoKeyOf = async (id: string) => {
    const row = await db
      .collection<{ _id: string; photo_key?: string }>('profiles')
      .findOne({ _id: id });
    return row?.photo_key ?? '';
  };

  describe('indexes', () => {
    it('can be asked for again, as every new server process does', async () => {
      await expect(ensureIndexes(db)).resolves.toBeUndefined();
    });

    it('let no two photos answer to one key, and leave students without one alone', async () => {
      const indexes = await db.collection('profiles').indexes();
      expect(indexes.find(({ name }) => name === 'photo_key_1')).toMatchObject({
        unique: true,
        sparse: true,
      });
    });

    it('can count the reports of a photo, of a student this week, and find them to delete', async () => {
      const names = (await db.collection('photo_reports').indexes()).map(({ name }) => name);
      expect(names).toEqual(
        expect.arrayContaining(['photo_key_1', 'reporter_id_1_created_at_1', 'owner_id_1']),
      );
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

    it('keeps the first welcome when the screen is finished again', async () => {
      const { id } = await student(ACCOUNT, 'm5-1');
      await store.updateAccount(id, { showOnLeaderboard: false });
      // The research team put this student in the control group.
      await db
        .collection<{ _id: string }>('profiles')
        .updateOne({ _id: id }, { $set: { condition: 'fixed' } });
      const again: Account = { ...ACCOUNT, displayName: 'อีกชื่อ', showOnLeaderboard: true };
      await store.createAccount(id, {
        account: again,
        cohort: 'other',
        profile: started(id),
        consentAt: '2026-11-20T02:00:00.000Z',
      });
      expect(await store.loadAccount(id)).toEqual({
        ...ACCOUNT,
        showOnLeaderboard: false,
        condition: 'fixed',
      });
      const row = await db.collection<{ _id: string }>('profiles').findOne({ _id: id });
      expect(row).toMatchObject({ cohort: 'm5-1', consent_at: new Date(CONSENT) });
    });

    it('is recorded for a student whose row has no consent yet', async () => {
      const id = randomUUID();
      await db.collection<{ _id: string }>('profiles').insertOne({ _id: id });
      await store.createAccount(id, { account: ACCOUNT, profile: started(id), consentAt: CONSENT });
      expect(await store.loadAccount(id)).toEqual(ACCOUNT);
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

    it('logs an answer to an item the server never opened, but pays it no XP', async () => {
      const { id, profile } = await student();
      const open = currentItem(profile) as MatrixItem;
      const ref = { ...open.ref, seed: open.ref.seed + 7 };
      const picked = rebuildItem(ref) as MatrixItem;
      const answer = (seq: number, item: MatrixItem): QueuedAction => ({
        seq,
        action: {
          type: 'attempt',
          ref: item.ref,
          answer: storeAnswer(item.correct),
          hintLevel: 0,
          timeMs: 10,
          at: AT,
        },
      });
      await processActions({
        store,
        userId: id,
        deviceId: 'device-a',
        actions: [answer(1, picked)],
      });
      const after = (await store.loadLearner(id))!.profile;
      await processActions({
        store,
        userId: id,
        deviceId: 'device-a',
        actions: [answer(2, currentItem(after) as MatrixItem)],
      });
      const rows = await db
        .collection('attempts')
        .find({ user_id: id })
        .sort({ seq: 1 })
        .project({ _id: 0, seq: 1, xp: 1, issued: 1 })
        .toArray();
      expect(rows).toEqual([
        { seq: 1, xp: 0, issued: false },
        { seq: 2, xp: 10, issued: true },
      ]);
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
    });

    it('lets a burst of tutor calls through only up to the limit', async () => {
      const { id } = await student();
      const limits = { perMinute: 20, perDay: 1000 };
      const at = new Date('2099-02-01T03:00:10.000Z');
      const results = await Promise.all(
        Array.from({ length: 30 }, () => store.reserveLlmCall(id, at, limits)),
      );
      expect(results.filter(Boolean)).toHaveLength(20);
      // The next minute starts again.
      expect(await store.reserveLlmCall(id, new Date('2099-02-01T03:01:10.000Z'), limits)).toBe(
        true,
      );
    });

    it('stops tutor calls for everyone once the day is used up', async () => {
      const limits = { perMinute: 20, perDay: 3 };
      const day = new Date('2099-02-02T03:00:00.000Z');
      const [a, b] = [await student(), await student()];
      expect(await store.reserveLlmCall(a.id, day, limits)).toBe(true);
      expect(await store.reserveLlmCall(b.id, day, limits)).toBe(true);
      expect(await store.reserveLlmCall(a.id, day, limits)).toBe(true);
      expect(await store.reserveLlmCall(b.id, day, limits)).toBe(false);
      expect(await store.reserveLlmCall(b.id, new Date('2099-02-03T03:00:00.000Z'), limits)).toBe(
        true,
      );
    });

    it('has MongoDB drop the call counters by itself', async () => {
      const indexes = await db.collection('llm_calls').indexes();
      expect(indexes.find(({ name }) => name === 'expires_at_1')?.expireAfterSeconds).toBe(0);
    });
  });

  describe('clip views', () => {
    it('logs each with the topic the student is on, under the names the export reads', async () => {
      const { id } = await student();
      const view = {
        template: 'cell_by_cell' as const,
        purpose: 'remediate' as const,
        beatsTotal: 6,
        beatsSeen: 4,
        replays: 1,
        skipped: false,
        durationMs: 30_500,
      };
      await processActions({
        store,
        userId: id,
        deviceId: 'device-a',
        actions: [{ seq: 1, action: { type: 'scene_view', view } }],
      });
      const row = await db
        .collection('scene_views')
        .findOne({ user_id: id }, { projection: { _id: 0 } });
      expect(row).toEqual({
        user_id: id,
        topic: 'matrix',
        template: 'cell_by_cell',
        purpose: 'remediate',
        beats_total: 6,
        beats_seen: 4,
        replays: 1,
        skipped: false,
        duration_ms: 30_500,
        created_at: expect.any(Date),
      });
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

    it('keeps the vector tests apart from the matrix ones, which are the research data', async () => {
      const { id } = await student();
      const vector = { ...taken, topic: 'vector', form: 'B', score: 3, total: 14 } as const;
      expect(await store.saveAssessment(id, { ...taken, responses: RESPONSES })).toBe(true);
      expect(await store.saveAssessment(id, { ...vector, responses: RESPONSES })).toBe(true);
      expect(await store.saveAssessment(id, { ...vector, score: 9, responses: RESPONSES })).toBe(
        false,
      );

      expect(await store.assessmentScores(id)).toEqual({ pre: { score: 1, total: 2 }, post: null });
      expect(await store.assessmentScores(id, 'vector')).toEqual({
        pre: { score: 3, total: 14 },
        post: null,
      });
      expect(await countOf('assessments', id)).toBe(1);
      expect(await countOf('vector_assessments', id)).toBe(1);
      const sat = await db.collection('vector_assessments').findOne({ user_id: id });
      const answersIn = (name: string) =>
        db.collection(name).countDocuments({ assessment_id: sat?._id });
      expect(await answersIn('vector_assessment_responses')).toBe(2);
      expect(await answersIn('assessment_responses')).toBe(0);

      // The forms the research export reads stay the matrix ones.
      const row = await db.collection<{ _id: string }>('profiles').findOne({ _id: id });
      expect(row).toMatchObject({ form_pre: 'A' });
      expect(row).not.toHaveProperty('form_post');
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

  describe('a profile photo', () => {
    const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);

    it('is kept for its student alone, said on the account, and gone once removed', async () => {
      const { id } = await student();
      const other = await student();
      expect(await store.loadPhoto(id)).toBeNull();
      expect(await store.loadAccount(id)).not.toHaveProperty('photoAt');

      const at = await store.savePhoto(id, { type: 'image/jpeg', data: JPEG });
      const kept = await store.loadPhoto(id);
      expect(kept?.type).toBe('image/jpeg');
      expect(new Uint8Array(kept?.data ?? [])).toEqual(JPEG);
      expect(kept?.at).toBe(at);
      expect(await store.loadAccount(id)).toMatchObject({ photoAt: at });
      expect(await store.loadPhoto(other.id)).toBeNull();

      await store.deletePhoto(id);
      expect(await store.loadPhoto(id)).toBeNull();
      expect(await store.loadAccount(id)).not.toHaveProperty('photoAt');
    });

    it('is not kept for someone who has not finished the welcome', async () => {
      const stranger = randomUUID();
      expect(await store.savePhoto(stranger, { type: 'image/jpeg', data: JPEG })).toBeNull();
      // Signed in once, so there is a row, but the consent line has not been passed.
      const halfway = randomUUID();
      await db.collection<{ _id: string }>('profiles').insertOne({ _id: halfway });
      expect(await store.savePhoto(halfway, { type: 'image/jpeg', data: JPEG })).toBeNull();
      for (const id of [stranger, halfway]) {
        expect(await db.collection<{ _id: string }>('photos').findOne({ _id: id })).toBeNull();
        expect(await store.loadPhoto(id)).toBeNull();
      }
      expect(await photoKeyOf(halfway)).toBe('');
    });

    it('is shown to others only once its student says so, under a key that is not their id', async () => {
      const { id } = await student();
      // With no picture there is nothing to show, so the switch stays off.
      await store.updateAccount(id, { showPhoto: true });
      expect(await store.loadAccount(id)).not.toHaveProperty('showPhoto');

      await store.savePhoto(id, { type: 'image/jpeg', data: JPEG });
      const key = await photoKeyOf(id);
      expect(key).toMatch(PHOTO_KEY);
      expect(key).not.toContain(id);
      expect(await store.loadAccount(id)).not.toHaveProperty('showPhoto');
      expect(await store.loadSharedPhoto(key)).toBeNull();

      await store.updateAccount(id, { showPhoto: true });
      expect(await store.loadAccount(id)).toMatchObject({ showPhoto: true });
      const shown = await store.loadSharedPhoto(key);
      expect(shown?.type).toBe('image/jpeg');
      expect(new Uint8Array(shown?.data ?? [])).toEqual(JPEG);
      // Asking by the student's id, as their own route does, is not a way in.
      expect(await store.loadSharedPhoto(id)).toBeNull();

      // Whoever leaves the board takes their picture with them, and brings it back.
      await store.updateAccount(id, { showOnLeaderboard: false });
      expect(await store.loadSharedPhoto(key)).toBeNull();
      await store.updateAccount(id, { showOnLeaderboard: true });
      expect(await store.loadSharedPhoto(key)).not.toBeNull();

      await store.updateAccount(id, { showPhoto: false });
      expect(await store.loadSharedPhoto(key)).toBeNull();
      expect(await store.loadAccount(id)).not.toHaveProperty('showPhoto');
      // Their own copy never depended on any of this.
      expect(await store.loadPhoto(id)).not.toBeNull();
    });

    it('changes nothing else about the account when the switch is turned', async () => {
      const { id } = await student({ ...ACCOUNT, displayName: 'ชื่อเดิม', avatar: 'theta' });
      const at = await store.savePhoto(id, { type: 'image/jpeg', data: JPEG });
      await store.updateAccount(id, { showPhoto: true });
      expect(await store.loadAccount(id)).toEqual({
        ...ACCOUNT,
        displayName: 'ชื่อเดิม',
        avatar: 'theta',
        photoAt: at,
        showPhoto: true,
      });
      await store.updateAccount(id, { displayName: 'ชื่อใหม่' });
      expect(await store.loadAccount(id)).toMatchObject({
        displayName: 'ชื่อใหม่',
        showPhoto: true,
      });
    });

    it('gets a new key with every new picture, so the old address shows nothing', async () => {
      const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 9]);
      const { id } = await student();
      await store.savePhoto(id, { type: 'image/jpeg', data: JPEG });
      await store.updateAccount(id, { showPhoto: true });
      const first = await photoKeyOf(id);

      await store.savePhoto(id, { type: 'image/png', data: PNG });
      const second = await photoKeyOf(id);
      expect(second).toMatch(PHOTO_KEY);
      expect(second).not.toBe(first);
      expect(await store.loadSharedPhoto(first)).toBeNull();
      // A replaced picture stays shown: the switch is the student's, and it is still on.
      expect((await store.loadSharedPhoto(second))?.type).toBe('image/png');
    });

    it('gives a picture from before there were keys its key when it is first shown', async () => {
      const { id } = await student();
      await store.savePhoto(id, { type: 'image/jpeg', data: JPEG });
      await db
        .collection<{ _id: string }>('profiles')
        .updateOne({ _id: id }, { $unset: { photo_key: '' } });
      expect(await photoKeyOf(id)).toBe('');

      await store.updateAccount(id, { showPhoto: true });
      const key = await photoKeyOf(id);
      expect(key).toMatch(PHOTO_KEY);
      expect(await store.loadSharedPhoto(key)).not.toBeNull();
      // Turning the switch again keeps the address the board has already handed out.
      await store.updateAccount(id, { showPhoto: true });
      expect(await photoKeyOf(id)).toBe(key);
    });

    it('stops being shown when it is removed, and the next one starts out hidden', async () => {
      const { id } = await student();
      await store.savePhoto(id, { type: 'image/jpeg', data: JPEG });
      await store.updateAccount(id, { showPhoto: true });
      const key = await photoKeyOf(id);

      await store.deletePhoto(id);
      expect(await store.loadSharedPhoto(key)).toBeNull();
      expect(await photoKeyOf(id)).toBe('');
      expect(await store.loadAccount(id)).not.toHaveProperty('showPhoto');

      await store.savePhoto(id, { type: 'image/jpeg', data: JPEG });
      expect(await store.loadAccount(id)).not.toHaveProperty('showPhoto');
      expect(await store.loadSharedPhoto(await photoKeyOf(id))).toBeNull();
    });

    it('is gone from everyone with its account', async () => {
      const { id } = await student();
      await store.savePhoto(id, { type: 'image/jpeg', data: JPEG });
      await store.updateAccount(id, { showPhoto: true });
      const key = await photoKeyOf(id);
      expect(await store.loadSharedPhoto(key)).not.toBeNull();

      await store.deleteAccount(id);
      expect(await store.loadSharedPhoto(key)).toBeNull();
      expect(await db.collection<{ _id: string }>('photos').findOne({ _id: id })).toBeNull();
    });
  });

  describe('reporting a photo', () => {
    const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);
    const RULES = { toHide: 3, perReporterPerWeek: 5, maxTakedowns: 2 };
    const NOW = new Date('2026-11-27T05:00:00.000Z');
    const DAY = 86_400_000;

    /** A student whose photo is on the board, and the key the board hands out for it. */
    async function shownPhoto() {
      const { id } = await student();
      await store.savePhoto(id, { type: 'image/jpeg', data: JPEG });
      await store.updateAccount(id, { showPhoto: true });
      return { id, key: await photoKeyOf(id) };
    }
    const reporters = (n: number) => Promise.all(Array.from({ length: n }, () => student()));
    const reportsOf = (key: string) =>
      db.collection('photo_reports').countDocuments({ photo_key: key });

    it('takes the photo off the board once enough different students report it', async () => {
      const owner = await shownPhoto();
      const [first, second, third] = await reporters(3);

      expect(await store.reportPhoto(owner.key, first.id, NOW, RULES)).toBe('recorded');
      // One student counts once, however often they ask.
      expect(await store.reportPhoto(owner.key, first.id, NOW, RULES)).toBe('ignored');
      expect(await store.reportPhoto(owner.key, second.id, NOW, RULES)).toBe('recorded');
      expect(await reportsOf(owner.key)).toBe(2);
      expect(await store.loadSharedPhoto(owner.key)).not.toBeNull();
      // Short of enough, the owner is told nothing: who reported could be guessed from when.
      expect(await store.loadAccount(owner.id)).toEqual({
        ...ACCOUNT,
        photoAt: expect.any(String),
        showPhoto: true,
      });

      expect(await store.reportPhoto(owner.key, third.id, NOW, RULES)).toBe('recorded');
      expect(await store.loadSharedPhoto(owner.key)).toBeNull();
      const told = await store.loadAccount(owner.id);
      expect(told).toMatchObject({ photoReported: true });
      expect(told).not.toHaveProperty('showPhoto');
      expect(told).not.toHaveProperty('photoLocked');
      // It is still the owner's own photo, for their own eyes.
      expect(await store.loadPhoto(owner.id)).not.toBeNull();
      // And a report after it is down changes nothing more.
      const [late] = await reporters(1);
      expect(await store.reportPhoto(owner.key, late.id, NOW, RULES)).toBe('ignored');
    });

    it('says nothing in the account that could tell who reported, or how many', async () => {
      const owner = await shownPhoto();
      const three = await reporters(3);
      for (const { id } of three) await store.reportPhoto(owner.key, id, NOW, RULES);
      const text = JSON.stringify(await store.loadAccount(owner.id));
      for (const { id } of three) expect(text).not.toContain(id);
      expect(Object.keys((await store.loadAccount(owner.id)) ?? {}).sort()).toEqual(
        [
          'avatar',
          'condition',
          'displayName',
          'photoAt',
          'photoReported',
          'showOnLeaderboard',
        ].sort(),
      );
    });

    it('does not show a reported photo again as it is, and shows the next one if asked', async () => {
      const owner = await shownPhoto();
      for (const { id } of await reporters(3)) await store.reportPhoto(owner.key, id, NOW, RULES);

      await store.updateAccount(owner.id, { showPhoto: true });
      expect(await store.loadAccount(owner.id)).not.toHaveProperty('showPhoto');
      expect(await store.loadSharedPhoto(owner.key)).toBeNull();

      await store.savePhoto(owner.id, { type: 'image/jpeg', data: JPEG });
      const fresh = await store.loadAccount(owner.id);
      expect(fresh).not.toHaveProperty('photoReported');
      // A new photo starts out private again: showing it is asked for anew.
      expect(fresh).not.toHaveProperty('showPhoto');
      await store.updateAccount(owner.id, { showPhoto: true });
      const key = await photoKeyOf(owner.id);
      expect(await store.loadSharedPhoto(key)).not.toBeNull();
      // The reports were of the photo before it, so this one starts with none.
      const [again] = await reporters(1);
      expect(await store.reportPhoto(key, again.id, NOW, RULES)).toBe('recorded');
      expect(await store.loadSharedPhoto(key)).not.toBeNull();
    });

    it('shows no more photos of a student whose photos were taken down twice', async () => {
      const owner = await shownPhoto();
      for (const { id } of await reporters(3)) await store.reportPhoto(owner.key, id, NOW, RULES);
      await store.savePhoto(owner.id, { type: 'image/jpeg', data: JPEG });
      await store.updateAccount(owner.id, { showPhoto: true });
      const second = await photoKeyOf(owner.id);
      expect(await store.loadAccount(owner.id)).not.toHaveProperty('photoLocked');
      for (const { id } of await reporters(3)) await store.reportPhoto(second, id, NOW, RULES);
      expect(await store.loadAccount(owner.id)).toMatchObject({
        photoReported: true,
        photoLocked: true,
      });

      await store.savePhoto(owner.id, { type: 'image/jpeg', data: JPEG });
      const third = await photoKeyOf(owner.id);
      await store.updateAccount(owner.id, { showPhoto: true });
      const locked = await store.loadAccount(owner.id);
      expect(locked).toMatchObject({ photoLocked: true });
      expect(locked).not.toHaveProperty('showPhoto');
      expect(locked).not.toHaveProperty('photoReported');
      expect(await store.loadSharedPhoto(third)).toBeNull();
      // Removing the photo does not wipe the slate either.
      await store.deletePhoto(owner.id);
      expect(await store.loadAccount(owner.id)).toMatchObject({ photoLocked: true });
    });

    it("ignores a report of one's own photo, of a photo not shown, and of a key that is nobody's", async () => {
      const owner = await shownPhoto();
      const [other] = await reporters(1);
      expect(await store.reportPhoto(owner.key, owner.id, NOW, RULES)).toBe('ignored');

      const hidden = await student();
      await store.savePhoto(hidden.id, { type: 'image/jpeg', data: JPEG });
      expect(await store.reportPhoto(await photoKeyOf(hidden.id), other.id, NOW, RULES)).toBe(
        'ignored',
      );
      expect(await store.reportPhoto('AbCdEfGhIjKlMnOpQrSt_-', other.id, NOW, RULES)).toBe(
        'ignored',
      );

      await store.updateAccount(owner.id, { showOnLeaderboard: false });
      expect(await store.reportPhoto(owner.key, other.id, NOW, RULES)).toBe('ignored');
      expect(await db.collection('photo_reports').countDocuments({ reporter_id: other.id })).toBe(
        0,
      );
      expect(await reportsOf(owner.key)).toBe(0);
    });

    it('keeps no report from someone who has not finished the welcome', async () => {
      const owner = await shownPhoto();
      const stranger = randomUUID();
      expect(await store.reportPhoto(owner.key, stranger, NOW, RULES)).toBe('ignored');
      expect(await reportsOf(owner.key)).toBe(0);
    });

    it('lets one student report only so many photos in seven days', async () => {
      const [reporter] = await reporters(1);
      const photos = await Promise.all(Array.from({ length: 7 }, () => shownPhoto()));
      for (const { key } of photos.slice(0, 5)) {
        expect(await store.reportPhoto(key, reporter.id, NOW, RULES)).toBe('recorded');
      }
      expect(await store.reportPhoto(photos[5].key, reporter.id, NOW, RULES)).toBe('too_many');
      expect(await reportsOf(photos[5].key)).toBe(0);
      // One already made is not a new one, so it is not refused.
      expect(await store.reportPhoto(photos[0].key, reporter.id, NOW, RULES)).toBe('ignored');
      // Six days on the week is still full, and eight days on it has moved.
      const later = (days: number) => new Date(NOW.getTime() + days * DAY);
      expect(await store.reportPhoto(photos[5].key, reporter.id, later(6), RULES)).toBe('too_many');
      expect(await store.reportPhoto(photos[5].key, reporter.id, later(8), RULES)).toBe('recorded');
      // Another student is not held back by this one's count.
      const [other] = await reporters(1);
      expect(await store.reportPhoto(photos[6].key, other.id, NOW, RULES)).toBe('recorded');
    });

    it('cannot be used by a few to take down everyone: each of them runs out', async () => {
      const gang = await reporters(3);
      const photos = await Promise.all(Array.from({ length: 6 }, () => shownPhoto()));
      for (const { key } of photos) {
        for (const { id } of gang) await store.reportPhoto(key, id, NOW, RULES);
      }
      const down = await Promise.all(photos.map(({ key }) => store.loadSharedPhoto(key)));
      expect(down.filter((photo) => photo === null)).toHaveLength(RULES.perReporterPerWeek);
      expect(down[5]).not.toBeNull();
    });

    it('forgets a report with the account of who made it, and of whose photo it was', async () => {
      const owner = await shownPhoto();
      const [reporter, other] = await reporters(2);
      await store.reportPhoto(owner.key, reporter.id, NOW, RULES);
      await store.reportPhoto(owner.key, other.id, NOW, RULES);
      expect(await reportsOf(owner.key)).toBe(2);

      await store.deleteAccount(reporter.id);
      expect(
        await db.collection('photo_reports').countDocuments({ reporter_id: reporter.id }),
      ).toBe(0);
      expect(await reportsOf(owner.key)).toBe(1);

      await store.deleteAccount(owner.id);
      expect(await db.collection('photo_reports').countDocuments({ owner_id: owner.id })).toBe(0);
      expect(await reportsOf(owner.key)).toBe(0);
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

    it('carries the key of a photo for those who chose to show it, and for no one else', async () => {
      const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);
      const shows = await student({ ...ACCOUNT, displayName: 'เปิดรูป' }, 'ห้องรูป');
      const keeps = await student({ ...ACCOUNT, displayName: 'ไม่เปิด' }, 'ห้องรูป');
      const none = await student({ ...ACCOUNT, displayName: 'ไม่มีรูป' }, 'ห้องรูป');
      await store.savePhoto(shows.id, { type: 'image/jpeg', data: JPEG });
      await store.savePhoto(keeps.id, { type: 'image/jpeg', data: JPEG });
      await store.updateAccount(shows.id, { showPhoto: true });
      await earned(shows.id, 30);
      await earned(keeps.id, 20);
      await earned(none.id, 10);

      const board = await store.weeklyLeaderboard(WEEK, 10, 'ห้องรูป');
      expect(board).toEqual([
        {
          user_id: shows.id,
          display_name: 'เปิดรูป',
          avatar: 'pi',
          xp: 30,
          photo: await photoKeyOf(shows.id),
        },
        { user_id: keeps.id, display_name: 'ไม่เปิด', avatar: 'pi', xp: 20 },
        { user_id: none.id, display_name: 'ไม่มีรูป', avatar: 'pi', xp: 10 },
      ]);
      expect(board[0].photo).toMatch(PHOTO_KEY);

      await store.updateAccount(shows.id, { showPhoto: false });
      const after = await store.weeklyLeaderboard(WEEK, 10, 'ห้องรูป');
      expect(after[0]).not.toHaveProperty('photo');
    });

    it('keeps a class board to the students of that class link', async () => {
      const inClass = await student({ ...ACCOUNT, displayName: 'ห้องเอ' }, 'ห้องA');
      const otherClass = await student({ ...ACCOUNT, displayName: 'ห้องบี' }, 'ห้องB');
      const noClass = await student({ ...ACCOUNT, displayName: 'ไม่มีห้อง' });
      await earned(inClass.id, 30);
      await earned(otherClass.id, 40);
      await earned(noClass.id, 50);

      const board = await store.weeklyLeaderboard(WEEK, 10, 'ห้องA');
      expect(board.map(({ display_name }) => display_name)).toEqual(['ห้องเอ']);
      expect(await store.cohortOf(inClass.id)).toBe('ห้องA');
      expect(await store.cohortOf(noClass.id)).toBeNull();
      expect(JSON.stringify(board)).not.toContain('ห้องA');
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
      'vector_assessments',
      'llm_calls',
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
          topic: 'matrix',
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
      await store.reserveLlmCall(id, new Date());
      await store.savePhoto(id, {
        type: 'image/jpeg',
        data: new Uint8Array([0xff, 0xd8, 0xff, 0xe0]),
      });
      await store.saveAssessment(id, {
        topic: 'vector',
        phase: 'pre',
        form: 'B',
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
      const vectorTest = await db.collection('vector_assessments').findOne({ user_id: id });
      const vectorResponsesOf = (assessmentId: unknown) =>
        db
          .collection('vector_assessment_responses')
          .countDocuments({ assessment_id: assessmentId });
      expect(await vectorResponsesOf(vectorTest?._id)).toBe(2);

      await store.deleteAccount(id);

      // Every collection there is, so a new one cannot be forgotten here.
      const collections = await db.listCollections().toArray();
      expect(collections.length).toBeGreaterThanOrEqual(14);
      for (const { name } of collections) {
        const left = await db
          .collection<{ _id: string; user_id?: string }>(name)
          .countDocuments({ $or: [{ _id: id }, { user_id: id }] });
        expect(left, name).toBe(0);
      }
      expect(await responsesOf(assessment?._id)).toBe(0);
      expect(await vectorResponsesOf(vectorTest?._id)).toBe(0);
      expect(await auth.userOfSession(token)).toBeNull();

      for (const name of EVERYWHERE) expect(await countOf(name, other.id), name).toBeGreaterThan(0);
      expect(await other.auth.userOfSession(other.token)).toBe(other.id);
      expect(await store.loadAccount(other.id)).toEqual({
        ...ACCOUNT,
        photoAt: expect.any(String),
      });
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
