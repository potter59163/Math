import { commitAttempt, prepareAttempt, type PreparedAttempt } from '@/lib/director/rules';
import type { TutorWords } from '@/lib/director/turn';
import type { CandidateId, Condition, NextTurn, Profile, TurnMode } from '@/lib/director/types';
import type { AttemptOutcome } from '@/lib/learner/types';
import {
  applyAction,
  attemptEvent,
  type ActionResult,
  type LearnerAction,
  type SceneViewLog,
} from '@/lib/sync/actions';
import type { QueuedAction, SyncResponse } from '@/lib/sync/types';
import type { MatrixItem, MatrixItemRef } from '@/lib/topics/matrix/types';

// Applies a device's queued actions to the server's copy of a student. Written against `SyncStore` so
// that its rules can be tested without a database, and against the real one in lib/server/store.ts.

export interface LearnerRow {
  profile: Profile;
  rev: number;
  /** The last action applied from each device. */
  devices: Record<string, number>;
  condition: Condition;
}

export type LogEntry =
  | {
      kind: 'attempt';
      seq: number;
      item: MatrixItem;
      action: Extract<LearnerAction, { type: 'attempt' }>;
      outcome: AttemptOutcome;
      turn: NextTurn;
    }
  | { kind: 'decision'; turn: NextTurn }
  | { kind: 'session' }
  | { kind: 'hint'; itemRef: MatrixItemRef | null; level: number }
  | { kind: 'scene_view'; view: SceneViewLog };

export interface SyncStore {
  loadLearner(userId: string): Promise<LearnerRow | null>;
  /** False when someone else wrote first, so the caller reads again and starts over. */
  saveLearner(
    userId: string,
    row: Pick<LearnerRow, 'profile' | 'devices'>,
    expectedRev: number,
  ): Promise<boolean>;
  writeLogs(userId: string, deviceId: string, logs: LogEntry[]): Promise<void>;
}

/** Asks the tutor to choose among the rules' candidates. Null leaves it to the rules. */
export type Decide = (
  prepared: PreparedAttempt,
  context: { timeMs: number; hintLevel: number },
) => Promise<{ choice?: CandidateId; mode?: TurnMode; tutor: TutorWords } | null>;

export class NoLearnerError extends Error {}

const SAVE_TRIES = 3;

/** The tutor is only worth waiting for on the answer the student is looking at right now. */
function lastAttemptSeq(actions: QueuedAction[]): number | null {
  return actions.findLast(({ action }) => action.type === 'attempt')?.seq ?? null;
}

async function applyOne(
  profile: Profile,
  action: LearnerAction,
  condition: Condition,
  decide: Decide | null,
): Promise<{ result: ActionResult; item?: MatrixItem }> {
  if (action.type !== 'attempt') {
    return { result: applyAction(profile, action, condition) };
  }
  const event = attemptEvent(action);
  if (!event) return { result: { profile } };
  const prepared = prepareAttempt(profile, event, condition);
  const decided =
    decide && condition === 'adaptive'
      ? await decide(prepared, { timeMs: action.timeMs, hintLevel: action.hintLevel })
      : null;
  return {
    result: commitAttempt(
      decided?.mode ? { ...prepared, mode: decided.mode } : prepared,
      decided?.choice,
      decided?.tutor,
    ),
    item: event.item,
  };
}

function logsOf(
  { action, seq }: QueuedAction,
  before: Profile,
  { result, item }: { result: ActionResult; item?: MatrixItem },
): LogEntry[] {
  const { turn, outcome } = result;
  switch (action.type) {
    case 'attempt':
      return item && turn && outcome ? [{ kind: 'attempt', seq, item, action, outcome, turn }] : [];
    case 'start':
      return turn ? [{ kind: 'session' }, { kind: 'decision', turn }] : [];
    case 'practice':
    case 'help':
      return turn ? [{ kind: 'decision', turn }] : [];
    case 'hint': {
      const level = result.profile.current?.hintLevel ?? 0;
      return level > (before.current?.hintLevel ?? 0)
        ? [{ kind: 'hint', itemRef: before.current?.ref ?? null, level }]
        : [];
    }
    case 'scene_view':
      return [{ kind: 'scene_view', view: action.view }];
    default:
      return [];
  }
}

export interface ProcessInput {
  store: SyncStore;
  userId: string;
  deviceId: string;
  actions: QueuedAction[];
  decide?: Decide | null;
}

/**
 * Applies what is new, saves, then logs. A retry of a batch already applied changes nothing, and two
 * devices writing at once make one of them read again rather than lose the other's work.
 */
export async function processActions({
  store,
  userId,
  deviceId,
  actions,
  decide = null,
}: ProcessInput): Promise<SyncResponse> {
  let useTutor = true;
  for (let attempt = 0; attempt < SAVE_TRIES; attempt += 1) {
    const row = await store.loadLearner(userId);
    if (!row) throw new NoLearnerError(userId);

    const lastSeq = row.devices[deviceId] ?? 0;
    const fresh = actions.filter(({ seq }) => seq > lastSeq).sort((a, b) => a.seq - b.seq);
    if (fresh.length === 0) return { lastSeq, profile: row.profile, turn: null };

    const decideOn = lastAttemptSeq(fresh);
    const logs: LogEntry[] = [];
    let { profile } = row;
    let turn: NextTurn | null = null;
    for (const entry of fresh) {
      const before = profile;
      const applied = await applyOne(
        profile,
        entry.action,
        row.condition,
        useTutor && entry.seq === decideOn ? decide : null,
      );
      profile = applied.result.profile;
      if (entry.action.type === 'attempt' && applied.result.turn) turn = applied.result.turn;
      logs.push(...logsOf(entry, before, applied));
    }

    const newest = fresh.at(-1)!.seq;
    const devices = { ...row.devices, [deviceId]: newest };
    if (await store.saveLearner(userId, { profile, devices }, row.rev)) {
      await store.writeLogs(userId, deviceId, logs);
      return { lastSeq: newest, profile, turn };
    }
    // The tutor has had its turn, and asking again would keep the student waiting twice as long.
    useTutor = false;
  }
  throw new Error(`processActions: could not save for ${userId}`);
}
