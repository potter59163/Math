import { randomUUID } from 'node:crypto';
import { Binary, MongoServerError, type Db, type ObjectId } from 'mongodb';
import { CONFIG } from '@/lib/config';
import type { Profile } from '@/lib/director/types';
import { ASSESSED_TOPIC, type AssessmentPhase, type AssessmentStatus } from '@/lib/sync/assessment';
import type { BoardRow } from '@/lib/sync/leaderboard';
import type { Account, AccountUpdate, AvatarId } from '@/lib/sync/types';
import type { TopicId } from '@/lib/topics/types';
import type { PhotoType } from './photo';
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
  /** Keeps this student's photo in place of any earlier one, and says when. */
  savePhoto(userId: string, photo: { type: PhotoType; data: Uint8Array }): Promise<string>;
  /** This student's own photo, which is only ever served back to them (app/api/photo). */
  loadPhoto(userId: string): Promise<{ type: PhotoType; data: Uint8Array; at: string } | null>;
  deletePhoto(userId: string): Promise<void>;
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

export function createStore(db: Db): AppStore {
  const profiles = db.collection<ProfileDoc>('profiles');
  const learners = db.collection<LearnerDoc>('learner_profiles');
  const testsOf = (topic: TopicId) => db.collection<AssessmentDoc>(TEST_TABLES[topic].tests);
  const photos = db.collection<PhotoDoc>('photos');
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

    async updateAccount(userId, { displayName, avatar, showOnLeaderboard }) {
      await profiles.updateOne(
        { _id: userId },
        {
          $set: {
            ...(displayName !== undefined && { display_name: displayName }),
            ...(avatar !== undefined && { avatar }),
            ...(showOnLeaderboard !== undefined && { show_on_leaderboard: showOnLeaderboard }),
            updated_at: new Date(),
          },
        },
      );
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
      const at = new Date();
      await photos.updateOne(
        { _id: userId },
        { $set: { type, data: new Binary(data), size: data.length, updated_at: at } },
        { upsert: true },
      );
      await profiles.updateOne({ _id: userId }, { $set: { photo_at: at } });
      return at.toISOString();
    },

    async loadPhoto(userId) {
      const row = await photos.findOne({ _id: userId });
      if (!row) return null;
      return {
        type: row.type,
        data: new Uint8Array(row.data.read(0, row.data.length())),
        at: row.updated_at.toISOString(),
      };
    },

    async deletePhoto(userId) {
      await photos.deleteOne({ _id: userId });
      await profiles.updateOne({ _id: userId }, { $unset: { photo_at: '' } });
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
            },
          },
        ])
        .toArray();
    },
  };
}
