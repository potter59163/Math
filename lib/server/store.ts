import { randomUUID } from 'node:crypto';
import { Binary, MongoServerError, type Db, type ObjectId } from 'mongodb';
import { CONFIG } from '@/lib/config';
import type { Profile } from '@/lib/director/types';
import { ASSESSED_TOPIC, type AssessmentPhase, type AssessmentStatus } from '@/lib/sync/assessment';
import type { BoardRow } from '@/lib/sync/leaderboard';
import type { Account, AccountUpdate, AvatarId } from '@/lib/sync/types';
import type { TopicId } from '@/lib/topics/types';
import { newPhotoKey, type PhotoType } from './photo';
import type { LogEntry, SyncStore } from './sync';

/** A form of a topic's pre/post test, 'A' or 'B' (lib/topics/<topic>/assessment.ts). */
type FormId = string;

/**
 * Where each topic's tests are kept. The matrix rows are the research data, which
 * scripts/research-export.mjs reads under these names, and they stay exactly where they were. Another
 * topic's rows sit beside them, so neither a vector test nor going back to an older version of the app
 * can touch them: one collection for both would need a new unique index, which an older version would
 * fail to build once a student had taken both.
 */
const TEST_TABLES: Record<TopicId, { tests: string; responses: string }> = {
  matrix: { tests: 'assessments', responses: 'assessment_responses' },
  vector: { tests: 'vector_assessments', responses: 'vector_assessment_responses' },
};

// Every query here takes a user id that the route has already checked (lib/server/auth.ts). The field
// names are what scripts/export-data.mjs writes out and analysis/analyze.py reads, so keep them.

const DUPLICATE_KEY = 11000;

const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;

/** How many tutor calls one student may start in a minute, and everyone together in a day (UTC). */
export interface LlmLimits {
  perMinute: number;
  perDay: number;
}

const LLM_LIMITS: LlmLimits = {
  perMinute: CONFIG.llm.maxCallsPerMinutePerStudent,
  perDay: CONFIG.llm.maxCallsPerDay,
};

/** When reports take a photo off the board, and how far one student's reports go (CONFIG.photoReports). */
export interface PhotoReportRules {
  toHide: number;
  perReporterPerWeek: number;
  maxTakedowns: number;
}

/** `ignored`: it changed nothing, for a reason the reporter has no need to learn. */
export type PhotoReportResult = 'recorded' | 'ignored' | 'too_many';

function isDuplicateKey(error: unknown): boolean {
  return error instanceof MongoServerError && error.code === DUPLICATE_KEY;
}

/** Logging must never cost a student their answer, so a failed write is reported and left there. */
async function logged(what: string, write: () => Promise<unknown>): Promise<void> {
  try {
    await write();
  } catch (error) {
    console.error(`store: ${what}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/** Run once per process. Creating an index that already exists does nothing. */
export async function ensureIndexes(db: Db): Promise<void> {
  await Promise.all([
    db.collection('users').createIndexes([{ key: { google_sub: 1 }, unique: true }]),
    // A photo shown on the board is asked for by its key. Most students have none, hence sparse.
    db
      .collection('profiles')
      .createIndexes([{ key: { photo_key: 1 }, unique: true, sparse: true }]),
    // Counted per photo and per reporter's week, and found by either student when an account goes.
    db
      .collection('photo_reports')
      .createIndexes([
        { key: { photo_key: 1 } },
        { key: { reporter_id: 1, created_at: 1 } },
        { key: { owner_id: 1 } },
      ]),
    db.collection('auth_sessions').createIndexes([
      // MongoDB removes a session by itself once its date has passed.
      { key: { expires_at: 1 }, expireAfterSeconds: 0 },
      { key: { user_id: 1 } },
    ]),
    db.collection('sessions').createIndexes([{ key: { user_id: 1, started_at: 1 } }]),
    db.collection('attempts').createIndexes([
      // A retried batch must not count an answer twice.
      { key: { user_id: 1, device_id: 1, seq: 1 }, unique: true },
      { key: { user_id: 1, created_at: 1 } },
      { key: { created_at: 1 } },
    ]),
    db.collection('decisions').createIndexes([{ key: { user_id: 1, created_at: 1 } }]),
    // Counters of tutor calls, which MongoDB drops by itself once they are of no more use.
    db
      .collection('llm_calls')
      .createIndexes([{ key: { expires_at: 1 }, expireAfterSeconds: 0 }, { key: { user_id: 1 } }]),
    db.collection('scene_views').createIndexes([{ key: { user_id: 1, created_at: 1 } }]),
    db.collection('hint_events').createIndexes([{ key: { user_id: 1, created_at: 1 } }]),
    ...Object.values(TEST_TABLES).flatMap(({ tests, responses }) => [
      // The one row each student may have for a phase: a second submit is not a second chance.
      db.collection(tests).createIndexes([{ key: { user_id: 1, phase: 1 }, unique: true }]),
      db
        .collection(responses)
        .createIndexes([{ key: { assessment_id: 1, item_no: 1 }, unique: true }]),
    ]),
  ]);
}

export interface AttemptRowInput {
  userId: string;
  deviceId: string;
  entry: Extract<LogEntry, { kind: 'attempt' }>;
}

function attemptRow({ userId, deviceId, entry }: AttemptRowInput) {
  const { seq, item, action, outcome } = entry;
  const { classification } = outcome;
  return {
    user_id: userId,
    device_id: deviceId,
    seq,
    item_ref: item.ref,
    skill: item.ref.skill,
    difficulty: item.ref.difficulty,
    kind: item.kind,
    target: item.ref.target ?? null,
    answer: action.answer,
    classification: classification.type,
    misconception: classification.type === 'misconception' ? classification.id : null,
    variant: classification.type === 'misconception' ? (classification.variant ?? null) : null,
    wrong_cells: classification.type === 'slip' ? [classification.cell] : null,
    time_ms: action.timeMs,
    hint_level: action.hintLevel,
    // The board sums this, so an item the device chose for itself counts for nothing there.
    xp: entry.issued ? outcome.xp + outcome.bonusXp : 0,
    issued: entry.issued,
    created_at: new Date(),
  };
}

function decisionRow(
  userId: string,
  attemptId: ObjectId | null,
  turn: Extract<LogEntry, { kind: 'decision' }>['turn'],
) {
  return {
    user_id: userId,
    attempt_id: attemptId,
    trigger: turn.trigger,
    mode: turn.mode,
    candidates: turn.candidates,
    choice: turn.choice,
    message: turn.message ?? null,
    path_note: turn.pathStep.note,
    narration: turn.scenes[0]?.narration ?? null,
    reason: turn.reason,
    latency_ms: turn.latencyMs ?? null,
    fallback_reason: turn.fallbackReason ?? turn.fallback ?? null,
    created_at: new Date(),
  };
}

export interface AssessmentResponseRow {
  item_no: number;
  item_ref: unknown;
  answer: unknown;
  correct: boolean;
  misconception: string | null;
  variant: string | null;
  time_ms: number | null;
}

export interface NewAssessment {
  /** Whose test: the matrix one, the research's, unless said otherwise. */
  topic?: TopicId;
  phase: AssessmentPhase;
  form: FormId;
  score: number;
  total: number;
  startedAt: number;
  responses: AssessmentResponseRow[];
}

export interface AppStore extends SyncStore {
  loadAccount(userId: string): Promise<Account | null>;
  createAccount(
    userId: string,
    input: { account: Account; cohort?: string; profile: Profile; consentAt: string },
  ): Promise<void>;
  updateAccount(userId: string, update: AccountUpdate): Promise<void>;
  deleteAccount(userId: string): Promise<void>;
  attemptsSince(userId: string, since: string): Promise<number>;
  /**
   * Counts one tutor call for this student, and for everyone today, before it is made. False when
   * either is past its limit, and then the rules decide.
   */
  reserveLlmCall(userId: string, at: Date, limits?: LlmLimits): Promise<boolean>;
  /** This student's scores on one topic's tests, the matrix ones unless said otherwise. */
  assessmentScores(userId: string, topic?: TopicId): Promise<AssessmentStatus>;
  /** False when this student has already taken this test. */
  saveAssessment(userId: string, assessment: NewAssessment): Promise<boolean>;
  /**
   * Whoever chose to be on the board and earned XP since `weekStart`, highest first: everyone, or only
   * those who came in through the same class link.
   */
  weeklyLeaderboard(weekStart: string, maxRows: number, cohort?: string): Promise<BoardRow[]>;
  /** The class link this student came in through, which is compared on the server and never sent. */
  cohortOf(userId: string): Promise<string | null>;
  /**
   * Keeps this student's photo in place of any earlier one, under a new key, and says when. Null, and
   * nothing kept, for someone who has not finished the welcome: consent comes before any data.
   */
  savePhoto(userId: string, photo: { type: PhotoType; data: Uint8Array }): Promise<string | null>;
  /** This student's own photo, for themselves (app/api/photo). */
  loadPhoto(userId: string): Promise<{ type: PhotoType; data: Uint8Array; at: string } | null>;
  /**
   * The photo behind a key from the board, while its owner shows it there and is on the board
   * themselves (app/api/photo/[key]). The key is the only way in: nothing here takes another's id.
   */
  loadSharedPhoto(key: string): Promise<{ type: PhotoType; data: Uint8Array } | null>;
  /** Removes the photo and ends its showing, so a later one starts out seen by its student alone. */
  deletePhoto(userId: string): Promise<void>;
  /**
   * One student's report of a photo shown on the board, counted once. Enough of them from different
   * students take the photo off the board until its owner changes it, and a student whose photos keep
   * coming down shows no more. Nothing about a report is ever sent to a browser.
   */
  reportPhoto(
    key: string,
    reporterId: string,
    at: Date,
    rules?: PhotoReportRules,
  ): Promise<PhotoReportResult>;
}

interface ProfileDoc {
  _id: string;
  display_name: string;
  avatar: string;
  show_on_leaderboard: boolean;
  condition: Account['condition'];
  consent_at: Date;
  cohort?: string;
  form_pre?: FormId;
  form_post?: FormId;
  /** When the student's own photo was last set, which also tells the browser to fetch it again. */
  photo_at?: Date;
  /** What that photo is asked for by on the board: new with every photo, and never the user id. */
  photo_key?: string;
  /** The student switched on showing the photo on the board. Never true without a photo. */
  show_photo?: boolean;
  /** When reports took the photo they have now off the board. Gone with the photo. */
  photo_reported_at?: Date;
  /** How many of their photos reports have taken down, and whether that was once too many. */
  photo_takedowns?: number;
  photo_locked?: boolean;
  created_at: Date;
  updated_at: Date;
}

interface LearnerDoc {
  _id: string;
  profile: unknown;
  rev: number;
  devices: Record<string, number>;
  updated_at: Date;
}

interface PhotoDoc {
  _id: string;
  type: PhotoType;
  data: Binary;
  size: number;
  updated_at: Date;
}

/** `_id` is the photo's key and the reporter's id together, so a student counts once per photo. */
interface PhotoReportDoc {
  _id: string;
  photo_key: string;
  owner_id: string;
  reporter_id: string;
  created_at: Date;
}

interface AssessmentDoc {
  _id: string;
  user_id: string;
  phase: AssessmentPhase;
  form: FormId;
  score: number;
  total: number;
  started_at: Date;
  submitted_at: Date;
}

const bytesOf = (data: Binary) => new Uint8Array(data.read(0, data.length()));

export function createStore(db: Db): AppStore {
  const profiles = db.collection<ProfileDoc>('profiles');
  const learners = db.collection<LearnerDoc>('learner_profiles');
  const testsOf = (topic: TopicId) => db.collection<AssessmentDoc>(TEST_TABLES[topic].tests);
  const photos = db.collection<PhotoDoc>('photos');
  const photoReports = db.collection<PhotoReportDoc>('photo_reports');
  const attempts = db.collection('attempts');
  const decisions = db.collection('decisions');
  const llmCalls = db.collection<{ _id: string; n: number; user_id?: string; expires_at: Date }>(
    'llm_calls',
  );

  return {
    async loadLearner(userId) {
      const [learner, owner] = await Promise.all([
        learners.findOne({ _id: userId }),
        profiles.findOne({ _id: userId }, { projection: { condition: 1 } }),
      ]);
      if (!learner) return null;
      return {
        profile: learner.profile as Profile,
        rev: learner.rev,
        devices: learner.devices,
        condition: owner?.condition ?? 'adaptive',
      };
    },

    async saveLearner(userId, { profile, devices }, expectedRev) {
      const { matchedCount } = await learners.updateOne(
        { _id: userId, rev: expectedRev },
        { $set: { profile, devices, rev: expectedRev + 1, updated_at: new Date() } },
      );
      return matchedCount === 1;
    },

    async writeLogs(userId, deviceId, logs) {
      for (const entry of logs) {
        switch (entry.kind) {
          case 'attempt':
            await logged('attempt', async () => {
              const { upsertedId } = await attempts.updateOne(
                { user_id: userId, device_id: deviceId, seq: entry.seq },
                { $setOnInsert: attemptRow({ userId, deviceId, entry }) },
                { upsert: true },
              );
              // Null when this answer was logged already, and then so was its decision.
              if (upsertedId)
                await decisions.insertOne(decisionRow(userId, upsertedId, entry.turn));
            });
            break;
          case 'decision':
            await logged('decision', () =>
              decisions.insertOne(decisionRow(userId, null, entry.turn)),
            );
            break;
          case 'session':
            await logged('session', () =>
              db.collection('sessions').insertOne({ user_id: userId, started_at: new Date() }),
            );
            break;
          case 'hint':
            await logged('hint', () =>
              db.collection('hint_events').insertOne({
                user_id: userId,
                item_ref: entry.itemRef,
                level: entry.level,
                created_at: new Date(),
              }),
            );
            break;
          case 'scene_view': {
            const { view } = entry;
            await logged('scene_view', () =>
              db.collection('scene_views').insertOne({
                user_id: userId,
                topic: entry.topic,
                template: view.template,
                purpose: view.purpose,
                beats_total: view.beatsTotal,
                beats_seen: view.beatsSeen,
                replays: view.replays,
                skipped: view.skipped,
                duration_ms: view.durationMs,
                created_at: new Date(),
              }),
            );
            break;
          }
        }
      }
    },

    async loadAccount(userId) {
      const row = await profiles.findOne({ _id: userId });
      if (!row?.consent_at) return null;
      return {
        displayName: row.display_name,
        avatar: row.avatar as AvatarId,
        showOnLeaderboard: row.show_on_leaderboard,
        condition: row.condition,
        ...(row.photo_at && { photoAt: row.photo_at.toISOString() }),
        ...(row.photo_at && row.show_photo && { showPhoto: true }),
        ...(row.photo_at && row.photo_reported_at && { photoReported: true }),
        ...(row.photo_locked && { photoLocked: true }),
      };
    },

    async createAccount(userId, { account, cohort, profile, consentAt }) {
      const now = new Date();
      // Only a student with no consent yet: a second welcome, from a stale tab or a replayed request,
      // must not turn a leaderboard opt-out back on, move consent, or change the trial group.
      try {
        await profiles.updateOne(
          { _id: userId, consent_at: { $exists: false } },
          {
            $set: {
              display_name: account.displayName,
              avatar: account.avatar,
              show_on_leaderboard: account.showOnLeaderboard,
              condition: account.condition,
              consent_at: new Date(consentAt),
              updated_at: now,
              ...(cohort && { cohort }),
            },
            $setOnInsert: { created_at: now },
          },
          { upsert: true },
        );
      } catch (error) {
        // The student has consented already, so the upsert met their _id. The first welcome stands.
        if (!(error instanceof MongoServerError && error.code === DUPLICATE_KEY)) throw error;
      }
      // Finishing the welcome screen twice, in two tabs say, must not wipe what the first one started.
      await learners.updateOne(
        { _id: userId },
        { $setOnInsert: { profile, rev: 0, devices: {}, updated_at: now } },
        { upsert: true },
      );
    },

    async updateAccount(userId, { displayName, avatar, showOnLeaderboard, showPhoto }) {
      await profiles.updateOne(
        { _id: userId },
        {
          $set: {
            ...(displayName !== undefined && { display_name: displayName }),
            ...(avatar !== undefined && { avatar }),
            ...(showOnLeaderboard !== undefined && { show_on_leaderboard: showOnLeaderboard }),
            ...(showPhoto === false && { show_photo: false }),
            updated_at: new Date(),
          },
        },
      );
      if (!showPhoto) return;
      // Showing takes a photo to show, so without one the switch stays off, as it does for a photo
      // that reports took down and for a student whose photos are shown no more. A photo from before
      // there were keys gets its key here; any other keeps the one the board has handed out.
      const withPhoto = {
        _id: userId,
        photo_at: { $exists: true },
        photo_reported_at: { $exists: false },
        photo_locked: { $ne: true },
      };
      await profiles.updateOne(
        { ...withPhoto, photo_key: { $exists: false } },
        { $set: { photo_key: newPhotoKey() } },
      );
      await profiles.updateOne(withPhoto, { $set: { show_photo: true } });
    },

    async deleteAccount(userId) {
      // Nothing cascades here, so this is the list of everything about a student. The sign-in goes last:
      // if a step fails the student is still signed in, and deleting again finishes the job.
      for (const topic of Object.keys(TEST_TABLES) as TopicId[]) {
        const taken = await testsOf(topic)
          .find({ user_id: userId }, { projection: { _id: 1 } })
          .toArray();
        await db
          .collection(TEST_TABLES[topic].responses)
          .deleteMany({ assessment_id: { $in: taken.map(({ _id }) => _id) } });
      }
      const tests = Object.values(TEST_TABLES).map(({ tests: name }) => name);
      await Promise.all(
        [
          ...tests,
          'attempts',
          'decisions',
          'scene_views',
          'hint_events',
          'sessions',
          'llm_calls',
        ].map((name) => db.collection(name).deleteMany({ user_id: userId })),
      );
      await Promise.all([
        learners.deleteOne({ _id: userId }),
        profiles.deleteOne({ _id: userId }),
        photos.deleteOne({ _id: userId }),
        // The reports this student made, and those made of their photos.
        photoReports.deleteMany({ $or: [{ reporter_id: userId }, { owner_id: userId }] }),
      ]);
      await db.collection('auth_sessions').deleteMany({ user_id: userId });
      await db.collection<{ _id: string }>('users').deleteOne({ _id: userId });
    },

    attemptsSince(userId, since) {
      return attempts.countDocuments({ user_id: userId, created_at: { $gte: new Date(since) } });
    },

    async reserveLlmCall(userId, at, limits = LLM_LIMITS) {
      // One atomic $inc per counter: answers sent at once each see their own count, so a burst
      // cannot all read the same total and pass together. Timeouts and errors count too.
      const minute = Math.floor(at.getTime() / MINUTE_MS);
      const mine = await llmCalls.findOneAndUpdate(
        { _id: `user:${userId}:${minute}` },
        {
          $inc: { n: 1 },
          $setOnInsert: { user_id: userId, expires_at: new Date(at.getTime() + 5 * MINUTE_MS) },
        },
        { upsert: true, returnDocument: 'after' },
      );
      if ((mine?.n ?? 0) > limits.perMinute) return false;
      const all = await llmCalls.findOneAndUpdate(
        { _id: `day:${at.toISOString().slice(0, 10)}` },
        { $inc: { n: 1 }, $setOnInsert: { expires_at: new Date(at.getTime() + 2 * DAY_MS) } },
        { upsert: true, returnDocument: 'after' },
      );
      return (all?.n ?? 0) <= limits.perDay;
    },

    async assessmentScores(userId, topic = ASSESSED_TOPIC) {
      const taken = await testsOf(topic).find({ user_id: userId }).toArray();
      const of = (phase: AssessmentPhase) => {
        const row = taken.find((entry) => entry.phase === phase);
        return row ? { score: row.score, total: row.total } : null;
      };
      return { pre: of('pre'), post: of('post') };
    },

    async saveAssessment(
      userId,
      { topic = ASSESSED_TOPIC, phase, form, score, total, startedAt, responses },
    ) {
      const id = randomUUID();
      try {
        await testsOf(topic).insertOne({
          _id: id,
          user_id: userId,
          phase,
          form,
          score,
          total,
          started_at: new Date(startedAt),
          submitted_at: new Date(),
        });
      } catch (error) {
        if (isDuplicateKey(error)) return false;
        throw error;
      }
      await logged('assessment responses', () =>
        db
          .collection(TEST_TABLES[topic].responses)
          .insertMany(responses.map((row) => ({ ...row, assessment_id: id }))),
      );
      // The profile's forms are the research's, which the export reads: the matrix ones alone.
      if (topic !== ASSESSED_TOPIC) return true;
      await logged('assessment form', () =>
        profiles.updateOne(
          { _id: userId },
          { $set: phase === 'pre' ? { form_pre: form } : { form_post: form } },
        ),
      );
      return true;
    },

    async savePhoto(userId, { type, data }) {
      const consented = { _id: userId, consent_at: { $exists: true } };
      if (!(await profiles.findOne(consented, { projection: { _id: 1 } }))) return null;
      const at = new Date();
      await photos.updateOne(
        { _id: userId },
        { $set: { type, data: new Binary(data), size: data.length, updated_at: at } },
        { upsert: true },
      );
      // A new key with every photo: the address of the one before it then shows nothing, and the
      // reports of that one are not held against this one.
      await profiles.updateOne(
        { _id: userId },
        { $set: { photo_at: at, photo_key: newPhotoKey() }, $unset: { photo_reported_at: '' } },
      );
      return at.toISOString();
    },

    async loadPhoto(userId) {
      const row = await photos.findOne({ _id: userId });
      if (!row) return null;
      return { type: row.type, data: bytesOf(row.data), at: row.updated_at.toISOString() };
    },

    async loadSharedPhoto(key) {
      const owner = await profiles.findOne(
        { photo_key: key, show_photo: true, show_on_leaderboard: true },
        { projection: { _id: 1 } },
      );
      if (!owner) return null;
      const row = await photos.findOne({ _id: owner._id });
      return row && { type: row.type, data: bytesOf(row.data) };
    },

    async deletePhoto(userId) {
      await photos.deleteOne({ _id: userId });
      await profiles.updateOne(
        { _id: userId },
        { $unset: { photo_at: '', photo_key: '', show_photo: '', photo_reported_at: '' } },
      );
    },

    async reportPhoto(key, reporterId, at, rules = CONFIG.photoReports) {
      // Only what the board is showing can be reported, and nobody reports themselves.
      const shown = { photo_key: key, show_photo: true, show_on_leaderboard: true };
      const owner = await profiles.findOne(shown, { projection: { _id: 1 } });
      if (!owner || owner._id === reporterId) return 'ignored';
      // A report is kept under the reporter's account, so there has to be one: consent comes first.
      const reporter = { _id: reporterId, consent_at: { $exists: true } };
      if (!(await profiles.findOne(reporter, { projection: { _id: 1 } }))) return 'ignored';

      const id = `${key}:${reporterId}`;
      if (await photoReports.findOne({ _id: id }, { projection: { _id: 1 } })) return 'ignored';
      const thisWeek = await photoReports.countDocuments({
        reporter_id: reporterId,
        created_at: { $gt: new Date(at.getTime() - 7 * DAY_MS) },
      });
      if (thisWeek >= rules.perReporterPerWeek) return 'too_many';
      try {
        await photoReports.insertOne({
          _id: id,
          photo_key: key,
          owner_id: owner._id,
          reporter_id: reporterId,
          created_at: at,
        });
      } catch (error) {
        // The same report sent twice at once: the first one counted.
        if (isDuplicateKey(error)) return 'ignored';
        throw error;
      }

      if ((await photoReports.countDocuments({ photo_key: key })) >= rules.toHide) {
        // Matched once only: after it the photo is no longer shown, so a late report finds nothing.
        const taken = await profiles.findOneAndUpdate(
          { _id: owner._id, ...shown },
          { $set: { show_photo: false, photo_reported_at: at }, $inc: { photo_takedowns: 1 } },
          { returnDocument: 'after', projection: { photo_takedowns: 1 } },
        );
        if ((taken?.photo_takedowns ?? 0) >= rules.maxTakedowns) {
          await profiles.updateOne({ _id: owner._id }, { $set: { photo_locked: true } });
        }
      }
      return 'recorded';
    },

    async cohortOf(userId) {
      const row = await profiles.findOne({ _id: userId }, { projection: { cohort: 1 } });
      return row?.cohort ?? null;
    },

    weeklyLeaderboard(weekStart, maxRows, cohort) {
      return attempts
        .aggregate<BoardRow>([
          { $match: { created_at: { $gte: new Date(weekStart) } } },
          { $group: { _id: '$user_id', xp: { $sum: '$xp' } } },
          { $match: { xp: { $gt: 0 } } },
          { $lookup: { from: 'profiles', localField: '_id', foreignField: '_id', as: 'owner' } },
          { $unwind: '$owner' },
          {
            $match: {
              'owner.show_on_leaderboard': true,
              ...(cohort !== undefined && { 'owner.cohort': cohort }),
            },
          },
          { $sort: { xp: -1, _id: 1 } },
          { $limit: maxRows },
          {
            $project: {
              _id: 0,
              user_id: '$_id',
              display_name: '$owner.display_name',
              avatar: '$owner.avatar',
              xp: 1,
              // The key of a photo, for those who show theirs: no field at all for everyone else.
              photo: {
                $cond: [{ $eq: ['$owner.show_photo', true] }, '$owner.photo_key', '$$REMOVE'],
              },
            },
          },
        ])
        .toArray();
    },
  };
}
