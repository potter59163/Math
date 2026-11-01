import { newProfile } from '@/lib/director/turn';
import type { Profile } from '@/lib/director/types';
import { ALL_UNITS } from '@/lib/learner/progress';
import type { ThemeId } from '@/lib/learner/types';
import { applyAction, type ActionResult, type LearnerAction } from '@/lib/sync/actions';
import type {
  Account,
  AccountUpdate,
  MeResponse,
  QueuedAction,
  SyncResponse,
  WelcomeRequest,
} from '@/lib/sync/types';

// The student on this device. Every action is applied here first, so the screen never waits for the
// network, then queued for the server, which applies the same action to its own copy. A dropped
// connection only delays the queue. Storage can be missing, full or blocked (private windows), so each
// access is guarded and the app carries on in memory.

/**
 * Bump when an older Profile could be misread: it is then ignored, and that student's copy on this
 * device is gone. An account gets its copy back from the server, while a guest starts over.
 */
export const PROFILE_VERSION = 3;

export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export type LearnerPhase = 'loading' | 'signed_out' | 'needs_welcome' | 'ready';

export type LearnerMode = 'guest' | 'account';

export interface LearnerState {
  phase: LearnerPhase;
  mode: LearnerMode | null;
  /** Supabase keys are set on the server, so signing in can work. */
  configured: boolean;
  /** The tutor is on, so a decision may be worth a moment's wait. */
  llm: boolean;
  account: Account | null;
  profile: Profile | null;
  /** The server has an answer and may come back with the tutor's decision on it. */
  thinking: boolean;
  offline: boolean;
}

export const INITIAL_STATE: LearnerState = {
  phase: 'loading',
  mode: null,
  configured: false,
  llm: false,
  account: null,
  profile: null,
  thinking: false,
  offline: false,
};

export interface LearnerEnv {
  storage(): StorageLike;
  fetch: typeof fetch;
  randomId(): string;
  /** Returns a way to cancel. */
  later(run: () => void, ms: number): () => void;
}

const DEVICE_KEY = 'math:device';
const CURRENT_KEY = 'math:current';
const profileKey = (id: string) => `math:profile:${id}`;
const queueKey = (id: string) => `math:queue:${id}`;
const accountKey = (id: string) => `math:account:${id}`;

const BATCH_SIZE = 50;
const RETRY_FIRST_MS = 2000;
const RETRY_MAX_MS = 30_000;

interface Current {
  id: string;
  mode: LearnerMode;
}

interface Queue {
  nextSeq: number;
  items: QueuedAction[];
}

export interface Learner {
  getState(): LearnerState;
  subscribe(listener: () => void): () => void;
  /** Reads this device, then asks the server who is signed in. Safe to call from every page. */
  boot(): Promise<void>;
  dispatch(action: LearnerAction): ActionResult;
  /** Starts learning with nothing saved beyond this device. */
  startGuest(theme: ThemeId): void;
  /** The first sign-in: consent, name and theme. Carries over any guest progress on this device. */
  finishWelcome(input: Omit<WelcomeRequest, 'guestProfile' | 'consent'>): Promise<boolean>;
  updateAccount(update: AccountUpdate): Promise<boolean>;
  /** Forgets this device's copy. The caller signs out of Supabase. */
  forgetDevice(): void;
  deleteAccount(): Promise<boolean>;
  /** Resolves once the server has answered the last answer sent, or after `maxMs`. */
  settled(maxMs: number): Promise<void>;
  /** Sends whatever is queued. Called again on its own when the connection comes back. */
  flush(): Promise<void>;
  /** Takes a copy the server has just worked out, such as the path after a pre-test. */
  adopt(profile: Profile): void;
}

export function createLearner(env: LearnerEnv): Learner {
  let state: LearnerState = INITIAL_STATE;
  let booting: Promise<void> | null = null;
  let flushing: Promise<void> | null = null;
  let retryMs = RETRY_FIRST_MS;
  let cancelRetry: (() => void) | null = null;
  const listeners = new Set<() => void>();
  const waiters = new Set<() => void>();

  const setState = (change: Partial<LearnerState>) => {
    state = { ...state, ...change };
    for (const listener of listeners) listener();
    if (!state.thinking) {
      for (const done of waiters) done();
      waiters.clear();
    }
  };

  const guarded = <T>(action: (storage: StorageLike) => T, fallback: T): T => {
    try {
      return action(env.storage());
    } catch {
      return fallback;
    }
  };

  const readJson = <T>(key: string): T | null =>
    guarded((storage) => {
      const text = storage.getItem(key);
      return text === null ? null : (JSON.parse(text) as T);
    }, null);

  const writeJson = (key: string, value: unknown) =>
    guarded((storage) => storage.setItem(key, JSON.stringify(value)), undefined);

  const remove = (key: string) => guarded((storage) => storage.removeItem(key), undefined);

  const deviceId = (): string => {
    const known = guarded((storage) => storage.getItem(DEVICE_KEY), null);
    if (known) return known;
    const id = env.randomId();
    guarded((storage) => storage.setItem(DEVICE_KEY, id), undefined);
    return id;
  };

  const readCurrent = (): Current | null => {
    const current = readJson<Current>(CURRENT_KEY);
    return current?.id && current.mode ? current : null;
  };

  const readProfile = (id: string): Profile | null => {
    const stored = readJson<{ v: number; profile: Profile }>(profileKey(id));
    return stored?.v === PROFILE_VERSION ? stored.profile : null;
  };

  const saveProfile = (profile: Profile) => {
    writeJson(profileKey(profile.student.id), { v: PROFILE_VERSION, profile });
  };

  const readQueue = (id: string): Queue =>
    readJson<Queue>(queueKey(id)) ?? { nextSeq: 1, items: [] };

  const writeQueue = (id: string, queue: Queue) => writeJson(queueKey(id), queue);

  /** Takes the server's copy of this student as the truth, unless this device still has more to say. */
  const adopt = (profile: Profile) => {
    saveProfile(profile);
    setState({ profile });
  };

  const scheduleRetry = () => {
    cancelRetry?.();
    cancelRetry = env.later(() => void flush(), retryMs);
    retryMs = Math.min(retryMs * 2, RETRY_MAX_MS);
  };

  const flushOnce = async (): Promise<void> => {
    const id = state.profile?.student.id;
    if (state.mode !== 'account' || !id) return;
    for (;;) {
      const queue = readQueue(id);
      if (queue.items.length === 0) {
        setState({ thinking: false, offline: false });
        return;
      }
      const batch = queue.items.slice(0, BATCH_SIZE);
      let response: Response;
      try {
        response = await env.fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ deviceId: deviceId(), actions: batch }),
        });
      } catch {
        setState({ offline: true, thinking: false });
        scheduleRetry();
        return;
      }
      if (response.status === 401 || response.status === 409) {
        // Signed out elsewhere, or the account is gone. The queue stays for when they come back.
        setState({ thinking: false });
        return;
      }
      if (!response.ok) {
        setState({ thinking: false });
        scheduleRetry();
        return;
      }
      retryMs = RETRY_FIRST_MS;
      const data = (await response.json()) as SyncResponse;
      const left = readQueue(id);
      const remaining = left.items.filter(({ seq }) => seq > data.lastSeq);
      writeQueue(id, { ...left, items: remaining });
      // Only on an answer, while its feedback is on screen and the next item is not: a student never
      // sees the numbers change under them. Anything newer here means they have already moved on.
      const answered = batch.at(-1)?.action.type === 'attempt';
      if (remaining.length === 0 && answered) adopt(data.profile);
    }
  };

  const flush = (): Promise<void> => {
    if (!flushing) {
      flushing = flushOnce().finally(() => {
        flushing = null;
      });
    }
    return flushing;
  };

  const handleMe = (me: MeResponse, local: Current | null) => {
    const { configured, llm } = me;
    if (!me.userId) {
      if (local?.mode === 'guest') {
        setState({ configured, llm: false });
        return;
      }
      if (local) remove(CURRENT_KEY);
      setState({ configured, llm: false, phase: 'signed_out', mode: null, profile: null });
      return;
    }
    if (!me.account) {
      // Any guest progress stays where it is until the welcome screen carries it over.
      setState({ configured, llm, phase: 'needs_welcome' });
      return;
    }
    const id = me.userId;
    writeJson(CURRENT_KEY, { id, mode: 'account' } satisfies Current);
    writeJson(accountKey(id), me.account);
    const queue = readQueue(id);
    const unsent = queue.items.filter(({ seq }) => seq > me.lastSeq);
    if (unsent.length !== queue.items.length) writeQueue(id, { ...queue, items: unsent });
    const mine = unsent.length > 0 ? readProfile(id) : null;
    const profile = mine ?? me.profile ?? readProfile(id);
    if (profile) saveProfile(profile);
    setState({
      configured,
      llm,
      phase: profile ? 'ready' : 'needs_welcome',
      mode: 'account',
      account: me.account,
      profile,
    });
    if (unsent.length > 0) void flush();
  };

  const bootOnce = async () => {
    const local = readCurrent();
    const profile = local && readProfile(local.id);
    if (local && profile) {
      setState({
        phase: 'ready',
        mode: local.mode,
        profile,
        account: readJson<Account>(accountKey(local.id)),
      });
    }
    try {
      const response = await env.fetch(`/api/me?device=${encodeURIComponent(deviceId())}`);
      if (!response.ok) throw new Error(String(response.status));
      handleMe((await response.json()) as MeResponse, local && profile ? local : null);
    } catch {
      // No connection: what is on this device is still a working app.
      if (state.phase === 'loading') setState({ phase: 'signed_out' });
      else setState({ offline: true });
    }
  };

  return {
    getState: () => state,

    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    boot: () => {
      booting ??= bootOnce();
      return booting;
    },

    dispatch: (action) => {
      const { profile, mode, account } = state;
      if (!profile) throw new Error('dispatch: no student');
      const result = applyAction(profile, action, account?.condition ?? 'adaptive');
      saveProfile(result.profile);
      if (mode === 'account') {
        const id = profile.student.id;
        const queue = readQueue(id);
        writeQueue(id, {
          nextSeq: queue.nextSeq + 1,
          items: [...queue.items, { seq: queue.nextSeq, action }],
        });
        setState({
          profile: result.profile,
          thinking: state.thinking || (action.type === 'attempt' && state.llm),
        });
        void flush();
      } else {
        setState({ profile: result.profile });
      }
      return result;
    },

    startGuest: (theme) => {
      const earlier = readCurrent();
      const kept = earlier?.mode === 'guest' ? readProfile(earlier.id) : null;
      const id = earlier?.mode === 'guest' ? earlier.id : `guest-${env.randomId()}`;
      const profile: Profile = kept
        ? { ...kept, student: { ...kept.student, theme } }
        : newProfile({ id, units: [...ALL_UNITS], theme });
      writeJson(CURRENT_KEY, { id, mode: 'guest' } satisfies Current);
      saveProfile(profile);
      setState({ phase: 'ready', mode: 'guest', profile, account: null });
    },

    finishWelcome: async (input) => {
      const earlier = readCurrent();
      const guestProfile = earlier?.mode === 'guest' ? readProfile(earlier.id) : null;
      const body: WelcomeRequest = {
        ...input,
        consent: true,
        ...(guestProfile && { guestProfile }),
      };
      let response: Response;
      try {
        response = await env.fetch('/api/welcome', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      } catch {
        return false;
      }
      if (!response.ok) return false;
      const data = (await response.json()) as { account: Account; profile: Profile | null };
      if (!data.profile) return false;
      const id = data.profile.student.id;
      if (earlier?.mode === 'guest') remove(profileKey(earlier.id));
      writeJson(CURRENT_KEY, { id, mode: 'account' } satisfies Current);
      writeJson(accountKey(id), data.account);
      saveProfile(data.profile);
      setState({
        phase: 'ready',
        mode: 'account',
        account: data.account,
        profile: data.profile,
      });
      return true;
    },

    updateAccount: async (update) => {
      try {
        const response = await env.fetch('/api/me', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(update),
        });
        if (!response.ok) return false;
        const { account } = (await response.json()) as { account: Account | null };
        const id = state.profile?.student.id;
        if (account && id) writeJson(accountKey(id), account);
        if (account) setState({ account });
        return account !== null;
      } catch {
        return false;
      }
    },

    forgetDevice: () => {
      const id = state.profile?.student.id;
      if (id) {
        remove(profileKey(id));
        remove(queueKey(id));
        remove(accountKey(id));
      }
      remove(CURRENT_KEY);
      cancelRetry?.();
      setState({ phase: 'signed_out', mode: null, profile: null, account: null, thinking: false });
    },

    deleteAccount: async () => {
      try {
        const response = await env.fetch('/api/me', { method: 'DELETE' });
        return response.ok;
      } catch {
        return false;
      }
    },

    settled: (maxMs) =>
      new Promise<void>((resolve) => {
        if (!state.thinking) {
          resolve();
          return;
        }
        const finish = () => {
          waiters.delete(finish);
          cancel();
          resolve();
        };
        const cancel = env.later(finish, maxMs);
        waiters.add(finish);
      }),

    flush,

    adopt,
  };
}
