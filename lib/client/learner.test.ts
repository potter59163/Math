import { describe, expect, it } from 'vitest';
import { storeAnswer } from '@/lib/core/answerJson';
import { currentItem } from '@/lib/director/items';
import { newProfile } from '@/lib/director/turn';
import type { Profile } from '@/lib/director/types';
import type { Account, MeResponse, QueuedAction } from '@/lib/sync/types';
import type { MatrixItem } from '@/lib/topics/matrix/types';
import { createLearner, PROFILE_VERSION, type LearnerEnv, type StorageLike } from './learner';

const ACCOUNT: Account = {
  displayName: 'มิว',
  avatar: 'pi',
  showOnLeaderboard: true,
  condition: 'adaptive',
};

const USER = 'user-1';
const AT = 1_800_000_000_000;

function memoryStorage(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
}

interface Harness {
  env: LearnerEnv;
  storage: ReturnType<typeof memoryStorage>;
  sent: { url: string; body: unknown }[];
  retries: (() => void)[];
  /** How the next request is answered. */
  respond: (url: string, body: unknown) => Response | Promise<Response>;
}

function harness(): Harness {
  const storage = memoryStorage();
  const h: Harness = {
    storage,
    sent: [],
    retries: [],
    respond: () => new Response(null, { status: 500 }),
    env: {
      storage: () => storage,
      randomId: () => 'random-id-1',
      later: (run) => {
        h.retries.push(run);
        return () => {};
      },
      fetch: async (input, init) => {
        const url = String(input);
        const body = init?.body ? JSON.parse(String(init.body)) : undefined;
        h.sent.push({ url, body });
        return h.respond(url, body);
      },
    },
  };
  return h;
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

const me = (change: Partial<MeResponse> = {}): MeResponse => ({
  configured: true,
  llm: false,
  userId: null,
  account: null,
  profile: null,
  lastSeq: 0,
  ...change,
});

const accountProfile = () => newProfile({ id: USER, units: [1, 2, 3, 4, 5], theme: 'game' });

/** A student signed in, with an item open and every server answer an echo of what it was sent. */
async function signedIn(h: Harness, change: Partial<MeResponse> = {}) {
  const learner = createLearner(h.env);
  h.respond = (url, body) => {
    if (url.startsWith('/api/me')) {
      return json(me({ userId: USER, account: ACCOUNT, profile: accountProfile(), ...change }));
    }
    const { actions } = body as { actions: QueuedAction[] };
    return json({
      lastSeq: actions.at(-1)!.seq,
      profile: learner.getState().profile,
      turn: null,
    });
  };
  await learner.boot();
  return learner;
}

function answerOf(profile: Profile, seqIgnored = 0) {
  void seqIgnored;
  const item = currentItem(profile) as MatrixItem;
  return {
    type: 'attempt' as const,
    ref: item.ref,
    answer: storeAnswer(item.correct),
    hintLevel: 0 as const,
    timeMs: 5,
    at: AT,
  };
}

const finished = (learner: ReturnType<typeof createLearner>) => {
  learner.dispatch({ type: 'start' });
  learner.dispatch({ type: 'finish_scene' });
};

describe('signing in', () => {
  it('is signed out with no account and nothing on this device', async () => {
    const h = harness();
    h.respond = () => json(me());
    const learner = createLearner(h.env);
    await learner.boot();
    expect(learner.getState().phase).toBe('signed_out');
    expect(learner.getState().configured).toBe(true);
  });

  it('asks for the welcome screen on a first sign in', async () => {
    const h = harness();
    h.respond = () => json(me({ userId: USER }));
    const learner = createLearner(h.env);
    await learner.boot();
    expect(learner.getState().phase).toBe('needs_welcome');
  });

  it('opens with what the server has', async () => {
    const h = harness();
    const learner = await signedIn(h);
    expect(learner.getState().phase).toBe('ready');
    expect(learner.getState().mode).toBe('account');
    expect(learner.getState().account).toEqual(ACCOUNT);
    expect(learner.getState().profile?.student.id).toBe(USER);
  });

  it('still works on what this device has when the network is down', async () => {
    const h = harness();
    const first = await signedIn(h);
    finished(first);
    await first.flush().catch(() => {});

    h.respond = () => {
      throw new Error('offline');
    };
    const second = createLearner(h.env);
    await second.boot();
    expect(second.getState().phase).toBe('ready');
    expect(second.getState().offline).toBe(true);
    expect(second.getState().profile?.current).toBeDefined();
  });

  it('ends an expired session rather than showing someone else the last student', async () => {
    const h = harness();
    await signedIn(h);
    h.respond = () => json(me());
    const again = createLearner(h.env);
    await again.boot();
    expect(again.getState().phase).toBe('signed_out');
    expect(again.getState().profile).toBeNull();
  });

  it('ignores a copy saved by an older version', async () => {
    const h = harness();
    h.storage.data.set('math:current', JSON.stringify({ id: 'guest-x', mode: 'guest' }));
    h.storage.data.set(
      'math:profile:guest-x',
      JSON.stringify({ v: PROFILE_VERSION - 1, profile: accountProfile() }),
    );
    h.respond = () => json(me({ configured: false }));
    const learner = createLearner(h.env);
    await learner.boot();
    expect(learner.getState().phase).toBe('signed_out');
  });
});

describe('guest', () => {
  it('learns with nothing sent to the server', async () => {
    const h = harness();
    h.respond = () => json(me({ configured: false }));
    const learner = createLearner(h.env);
    await learner.boot();
    learner.startGuest('sport');
    expect(learner.getState().mode).toBe('guest');
    expect(learner.getState().profile?.student.theme).toBe('sport');
    finished(learner);
    h.sent.length = 0;
    learner.dispatch(answerOf(learner.getState().profile!));
    expect(learner.getState().profile?.xp).toBe(10);
    expect(h.sent).toEqual([]);
  });

  it('is still there after a reload', async () => {
    const h = harness();
    h.respond = () => json(me({ configured: false }));
    const first = createLearner(h.env);
    await first.boot();
    first.startGuest('food');
    finished(first);
    first.dispatch(answerOf(first.getState().profile!));

    const second = createLearner(h.env);
    await second.boot();
    expect(second.getState().mode).toBe('guest');
    expect(second.getState().profile?.xp).toBe(10);
  });

  it('carries progress over on the first sign in, then forgets the guest', async () => {
    const h = harness();
    h.respond = () => json(me({ configured: true }));
    const guest = createLearner(h.env);
    await guest.boot();
    guest.startGuest('game');
    finished(guest);
    guest.dispatch(answerOf(guest.getState().profile!));
    const guestId = guest.getState().profile!.student.id;

    h.respond = (url) => {
      if (url.startsWith('/api/me')) return json(me({ userId: USER }));
      return json({ account: ACCOUNT, profile: { ...accountProfile(), xp: 10 } });
    };
    const signedInNow = createLearner(h.env);
    await signedInNow.boot();
    expect(signedInNow.getState().phase).toBe('needs_welcome');
    const done = await signedInNow.finishWelcome({
      displayName: 'มิว',
      avatar: 'pi',
      theme: 'game',
    });
    expect(done).toBe(true);

    const body = h.sent.find(({ url }) => url === '/api/welcome')?.body as {
      guestProfile?: Profile;
      consent: boolean;
    };
    expect(body.consent).toBe(true);
    expect(body.guestProfile?.xp).toBe(10);
    expect(signedInNow.getState().mode).toBe('account');
    expect(h.storage.data.has(`math:profile:${guestId}`)).toBe(false);
  });
});

describe('the queue', () => {
  it('answers at once and sends in the background', async () => {
    const h = harness();
    const learner = await signedIn(h);
    finished(learner);
    const answer = answerOf(learner.getState().profile!);
    h.respond = (_url, body) => {
      const { actions } = body as { actions: QueuedAction[] };
      return json({
        lastSeq: actions.at(-1)!.seq,
        profile: learner.getState().profile,
        turn: null,
      });
    };
    learner.dispatch(answer);
    // Before the server has said anything.
    expect(learner.getState().profile?.xp).toBe(10);
    await learner.flush();
    const queue = JSON.parse(h.storage.data.get(`math:queue:${USER}`)!);
    expect(queue.items).toEqual([]);
  });

  it('numbers actions in order and keeps them through a failure', async () => {
    const h = harness();
    const learner = await signedIn(h);
    h.respond = () => {
      throw new Error('offline');
    };
    finished(learner);
    await learner.flush();
    expect(learner.getState().offline).toBe(true);
    const queue = JSON.parse(h.storage.data.get(`math:queue:${USER}`)!);
    expect(queue.items.map(({ seq }: QueuedAction) => seq)).toEqual([1, 2]);
    expect(h.retries.length).toBeGreaterThan(0);
  });

  it('sends what was left once the connection is back', async () => {
    const h = harness();
    const learner = await signedIn(h);
    h.respond = () => {
      throw new Error('offline');
    };
    finished(learner);
    await learner.flush();

    h.respond = (_url, body) => {
      const { actions } = body as { actions: QueuedAction[] };
      return json({
        lastSeq: actions.at(-1)!.seq,
        profile: learner.getState().profile,
        turn: null,
      });
    };
    h.retries.at(-1)!();
    await learner.flush();
    expect(learner.getState().offline).toBe(false);
    expect(JSON.parse(h.storage.data.get(`math:queue:${USER}`)!).items).toEqual([]);
  });

  it("takes the server's copy after an answer, which is how the tutor's words arrive", async () => {
    const h = harness();
    const learner = await signedIn(h);
    finished(learner);
    h.respond = (_url, body) => {
      const { actions } = body as { actions: QueuedAction[] };
      const local = learner.getState().profile!;
      return json({
        lastSeq: actions.at(-1)!.seq,
        profile: {
          ...local,
          pending: { ...local.pending!, turn: { ...local.pending!.turn, message: 'คำของคิว' } },
        },
        turn: null,
      });
    };
    learner.dispatch(answerOf(learner.getState().profile!));
    await learner.flush();
    expect(learner.getState().profile?.pending?.turn.message).toBe('คำของคิว');
  });

  it('does not take it once the student has moved on, so the numbers never change under them', async () => {
    const h = harness();
    const learner = await signedIn(h);
    finished(learner);
    let release: (value: Response) => void = () => {};
    h.respond = () => new Promise<Response>((resolve) => (release = resolve));
    learner.dispatch(answerOf(learner.getState().profile!));
    const flushing = learner.flush();
    await Promise.resolve();
    learner.dispatch({ type: 'finish_turn' });
    const localCurrent = learner.getState().profile?.current;

    const forged = { ...learner.getState().profile!, current: undefined };
    h.respond = (_url, body) => {
      const { actions } = body as { actions: QueuedAction[] };
      return json({ lastSeq: actions.at(-1)!.seq, profile: forged, turn: null });
    };
    release(json({ lastSeq: 3, profile: forged, turn: null }));
    await flushing;
    expect(learner.getState().profile?.current).toEqual(localCurrent);
  });

  it('keeps the queue when the session has ended, for when they sign back in', async () => {
    const h = harness();
    const learner = await signedIn(h);
    finished(learner);
    h.respond = () => new Response(null, { status: 401 });
    await learner.flush();
    expect(JSON.parse(h.storage.data.get(`math:queue:${USER}`)!).items.length).toBeGreaterThan(0);
  });

  it('sends a queue left by an earlier page before believing the server', async () => {
    const h = harness();
    const first = await signedIn(h);
    finished(first);
    const localXp = first.getState().profile!.current;

    h.respond = (url, body) => {
      if (url.startsWith('/api/me')) {
        return json(me({ userId: USER, account: ACCOUNT, profile: accountProfile() }));
      }
      const { actions } = body as { actions: QueuedAction[] };
      return json({ lastSeq: actions.at(-1)!.seq, profile: accountProfile(), turn: null });
    };
    const second = createLearner(h.env);
    await second.boot();
    expect(second.getState().profile?.current).toEqual(localXp);
    expect(h.sent.some(({ url }) => url === '/api/sync')).toBe(true);
  });

  it('drops what the server says it already has', async () => {
    const h = harness();
    const first = await signedIn(h);
    finished(first);
    h.respond = () =>
      json(me({ userId: USER, account: ACCOUNT, profile: accountProfile(), lastSeq: 2 }));
    const second = createLearner(h.env);
    await second.boot();
    expect(JSON.parse(h.storage.data.get(`math:queue:${USER}`)!).items).toEqual([]);
  });
});

describe('settled', () => {
  it('waits for the tutor only when it is on, and for no longer than asked', async () => {
    const h = harness();
    const learner = await signedIn(h, { llm: true });
    finished(learner);
    let release: (value: Response) => void = () => {};
    h.respond = () => new Promise<Response>((resolve) => (release = resolve));
    learner.dispatch(answerOf(learner.getState().profile!));
    expect(learner.getState().thinking).toBe(true);

    let done = false;
    const waiting = learner.settled(4500).then(() => {
      done = true;
    });
    await Promise.resolve();
    expect(done).toBe(false);
    h.retries.at(-1)!();
    await waiting;
    expect(done).toBe(true);
    release(new Response(null, { status: 500 }));
  });

  it('does not wait at all with the tutor off', async () => {
    const h = harness();
    const learner = await signedIn(h);
    finished(learner);
    h.respond = () => new Promise<Response>(() => {});
    learner.dispatch(answerOf(learner.getState().profile!));
    expect(learner.getState().thinking).toBe(false);
    await learner.settled(4500);
  });
});

describe('leaving', () => {
  it('forgets this device on sign out, so the next person starts clean', async () => {
    const h = harness();
    const learner = await signedIn(h);
    learner.forgetDevice();
    expect(learner.getState().phase).toBe('signed_out');
    expect(h.storage.data.has('math:current')).toBe(false);
    expect(h.storage.data.has(`math:profile:${USER}`)).toBe(false);
  });

  it('carries on in memory when storage is blocked', async () => {
    const h = harness();
    h.respond = () => json(me({ configured: false }));
    const blocked: LearnerEnv = {
      ...h.env,
      storage: () => {
        throw new Error('blocked');
      },
    };
    const learner = createLearner(blocked);
    await learner.boot();
    learner.startGuest('shop');
    finished(learner);
    learner.dispatch(answerOf(learner.getState().profile!));
    expect(learner.getState().profile?.xp).toBe(10);
  });
});
