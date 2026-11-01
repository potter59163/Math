import type { SupabaseClient } from '@supabase/supabase-js';
import type { Profile } from '@/lib/director/types';
import type { Account, AccountUpdate, AvatarId } from '@/lib/sync/types';
import type { LearnerRow, LogEntry, SyncStore } from './sync';

// Every query here takes a user id that the route has already checked (lib/server/supabase.ts).

const report = (what: string, error: { message: string } | null) => {
  // Logging must never cost a student their answer, so a failed insert is reported and left there.
  if (error) console.error(`store: ${what}: ${error.message}`);
};

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
  };
}

function decisionRow(
  userId: string,
  attemptId: number | null,
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
  };
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
}

interface AccountRow {
  display_name: string;
  avatar: string;
  show_on_leaderboard: boolean;
  condition: Account['condition'];
}

export function createStore(client: SupabaseClient): AppStore {
  return {
    async loadLearner(userId) {
      const { data, error } = await client
        .from('learner_profiles')
        .select('profile, rev, devices, profiles(condition)')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) throw new Error(`loadLearner: ${error.message}`);
      if (!data) return null;
      const owner = data.profiles as unknown as { condition: Account['condition'] } | null;
      return {
        profile: data.profile as Profile,
        rev: data.rev as number,
        devices: data.devices as LearnerRow['devices'],
        condition: owner?.condition ?? 'adaptive',
      };
    },

    async saveLearner(userId, { profile, devices }, expectedRev) {
      const { data, error } = await client
        .from('learner_profiles')
        .update({ profile, devices, rev: expectedRev + 1, updated_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('rev', expectedRev)
        .select('user_id');
      if (error) throw new Error(`saveLearner: ${error.message}`);
      return data.length === 1;
    },

    async writeLogs(userId, deviceId, logs) {
      for (const entry of logs) {
        switch (entry.kind) {
          case 'attempt': {
            const { data, error } = await client
              .from('attempts')
              .upsert(attemptRow({ userId, deviceId, entry }), {
                onConflict: 'user_id,device_id,seq',
                ignoreDuplicates: true,
              })
              .select('id');
            report('attempt', error);
            const attemptId = (data?.[0]?.id as number | undefined) ?? null;
            if (attemptId !== null) {
              const logged = await client
                .from('decisions')
                .insert(decisionRow(userId, attemptId, entry.turn));
              report('decision', logged.error);
            }
            break;
          }
          case 'decision': {
            const { error } = await client
              .from('decisions')
              .insert(decisionRow(userId, null, entry.turn));
            report('decision', error);
            break;
          }
          case 'session': {
            const { error } = await client.from('sessions').insert({ user_id: userId });
            report('session', error);
            break;
          }
          case 'hint': {
            const { error } = await client
              .from('hint_events')
              .insert({ user_id: userId, item_ref: entry.itemRef, level: entry.level });
            report('hint', error);
            break;
          }
          case 'scene_view': {
            const { view } = entry;
            const { error } = await client.from('scene_views').insert({
              user_id: userId,
              template: view.template,
              purpose: view.purpose,
              beats_total: view.beatsTotal,
              beats_seen: view.beatsSeen,
              replays: view.replays,
              skipped: view.skipped,
              duration_ms: view.durationMs,
            });
            report('scene_view', error);
            break;
          }
        }
      }
    },

    async loadAccount(userId) {
      const { data, error } = await client
        .from('profiles')
        .select('display_name, avatar, show_on_leaderboard, condition, consent_at')
        .eq('id', userId)
        .maybeSingle();
      if (error) throw new Error(`loadAccount: ${error.message}`);
      if (!data?.consent_at) return null;
      const row = data as AccountRow;
      return {
        displayName: row.display_name,
        avatar: row.avatar as AvatarId,
        showOnLeaderboard: row.show_on_leaderboard,
        condition: row.condition,
      };
    },

    async createAccount(userId, { account, cohort, profile, consentAt }) {
      const created = await client.from('profiles').upsert({
        id: userId,
        display_name: account.displayName,
        avatar: account.avatar,
        show_on_leaderboard: account.showOnLeaderboard,
        condition: account.condition,
        consent_at: consentAt,
        ...(cohort && { cohort }),
      });
      if (created.error) throw new Error(`createAccount: ${created.error.message}`);
      // Finishing the welcome screen twice, in two tabs say, must not wipe what the first one started.
      const learner = await client
        .from('learner_profiles')
        .upsert({ user_id: userId, profile }, { onConflict: 'user_id', ignoreDuplicates: true });
      if (learner.error) throw new Error(`createAccount: ${learner.error.message}`);
    },

    async updateAccount(userId, { displayName, avatar, showOnLeaderboard }) {
      const { error } = await client
        .from('profiles')
        .update({
          ...(displayName !== undefined && { display_name: displayName }),
          ...(avatar !== undefined && { avatar }),
          ...(showOnLeaderboard !== undefined && { show_on_leaderboard: showOnLeaderboard }),
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);
      if (error) throw new Error(`updateAccount: ${error.message}`);
    },

    async deleteAccount(userId) {
      // Every table hangs off auth.users with on delete cascade, so this removes all of it.
      const { error } = await client.auth.admin.deleteUser(userId);
      if (error) throw new Error(`deleteAccount: ${error.message}`);
    },

    async attemptsSince(userId, since) {
      const { count, error } = await client
        .from('attempts')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('created_at', since);
      if (error) throw new Error(`attemptsSince: ${error.message}`);
      return count ?? 0;
    },

    async llmCallsSince(userId, since) {
      const { count, error } = await client
        .from('decisions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('mode', 'llm')
        .gte('created_at', since);
      if (error) throw new Error(`llmCallsSince: ${error.message}`);
      return count ?? 0;
    },
  };
}
