import { randomUUID } from 'node:crypto';
import { MongoServerError, type Db, type ObjectId } from 'mongodb';
import type { Profile } from '@/lib/director/types';
import type { AssessmentPhase, AssessmentStatus } from '@/lib/sync/assessment';
import type { BoardRow } from '@/lib/sync/leaderboard';
import type { Account, AccountUpdate, AvatarId } from '@/lib/sync/types';
import type { FormId } from '@/lib/topics/matrix/assessment';
import type { LogEntry, SyncStore } from './sync';

// Every query here takes a user id that the route has already checked (lib/server/auth.ts). The field
// names are what scripts/export-data.mjs writes out and analysis/analyze.py reads, so keep them.

const DUPLICATE_KEY = 11000;

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
    db.collection('scene_views').createIndexes([{ key: { user_id: 1, created_at: 1 } }]),
    db.collection('hint_events').createIndexes([{ key: { user_id: 1, created_at: 1 } }]),
    // The one row each student may have for a phase: a second submit is not a second chance.
    db.collection('assessments').createIndexes([{ key: { user_id: 1, phase: 1 }, unique: true }]),
    db
      .collection('assessment_responses')
      .createIndexes([{ key: { assessment_id: 1, item_no: 1 }, unique: true }]),
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
    xp: outcome.xp + outcome.bonusXp,
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
  llmCallsSince(userId: string, since: string): Promise<number>;
  assessmentScores(userId: string): Promise<AssessmentStatus>;
  /** False when this student has already taken this test. */
  saveAssessment(userId: string, assessment: NewAssessment): Promise<boolean>;
  /** Whoever chose to be on the board and earned XP since `weekStart`, highest first. */
  weeklyLeaderboard(weekStart: string, maxRows: number): Promise<BoardRow[]>;
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
  const assessments = db.collection<AssessmentDoc>('assessments');
  const attempts = db.collection('attempts');
  const decisions = db.collection('decisions');

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
      };
    },

    async createAccount(userId, { account, cohort, profile, consentAt }) {
      const now = new Date();
      await profiles.updateOne(
        { _id: userId },
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
      const taken = await assessments
        .find({ user_id: userId }, { projection: { _id: 1 } })
        .toArray();
      await db
        .collection('assessment_responses')
        .deleteMany({ assessment_id: { $in: taken.map(({ _id }) => _id) } });
      await Promise.all(
        ['assessments', 'attempts', 'decisions', 'scene_views', 'hint_events', 'sessions'].map(
          (name) => db.collection(name).deleteMany({ user_id: userId }),
        ),
      );
      await Promise.all([learners.deleteOne({ _id: userId }), profiles.deleteOne({ _id: userId })]);
      await db.collection('auth_sessions').deleteMany({ user_id: userId });
      await db.collection<{ _id: string }>('users').deleteOne({ _id: userId });
    },

    attemptsSince(userId, since) {
      return attempts.countDocuments({ user_id: userId, created_at: { $gte: new Date(since) } });
    },

    llmCallsSince(userId, since) {
      return decisions.countDocuments({
        user_id: userId,
        mode: 'llm',
        created_at: { $gte: new Date(since) },
      });
    },

    async assessmentScores(userId) {
      const taken = await assessments.find({ user_id: userId }).toArray();
      const of = (phase: AssessmentPhase) => {
        const row = taken.find((entry) => entry.phase === phase);
        return row ? { score: row.score, total: row.total } : null;
      };
      return { pre: of('pre'), post: of('post') };
    },

    async saveAssessment(userId, { phase, form, score, total, startedAt, responses }) {
      const id = randomUUID();
      try {
        await assessments.insertOne({
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
          .collection('assessment_responses')
          .insertMany(responses.map((row) => ({ ...row, assessment_id: id }))),
      );
      await logged('assessment form', () =>
        profiles.updateOne(
          { _id: userId },
          { $set: phase === 'pre' ? { form_pre: form } : { form_post: form } },
        ),
      );
      return true;
    },

    weeklyLeaderboard(weekStart, maxRows) {
      return attempts
        .aggregate<BoardRow>([
          { $match: { created_at: { $gte: new Date(weekStart) } } },
          { $group: { _id: '$user_id', xp: { $sum: '$xp' } } },
          { $match: { xp: { $gt: 0 } } },
          { $lookup: { from: 'profiles', localField: '_id', foreignField: '_id', as: 'owner' } },
          { $unwind: '$owner' },
          { $match: { 'owner.show_on_leaderboard': true } },
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
