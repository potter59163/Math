import { describe, expect, it, vi } from 'vitest';

// The route as it runs on the server. What a report does to a photo is the store's business
// (lib/server/store.test.ts): here the store says how it went, and the route says as little as it can.
const server = vi.hoisted(() => ({
  signedIn: true as boolean,
  answer: 'recorded' as 'recorded' | 'ignored' | 'too_many',
  asked: [] as { key: string; reporter: string; at: unknown }[],
}));

vi.mock('@/lib/server/auth', () => ({
  signInConfigured: () => true,
  signedInUserId: async () => (server.signedIn ? 'student-2' : null),
}));
vi.mock('@/lib/server/db', () => ({ database: async () => ({}) }));
vi.mock('@/lib/server/store', () => ({
  createStore: () => ({
    reportPhoto: async (key: string, reporter: string, at: unknown) => {
      server.asked.push({ key, reporter, at });
      return server.answer;
    },
  }),
}));

import { POST } from './route';

const KEY = 'AbCdEfGhIjKlMnOpQrSt_-';

const report = (key: string, body?: unknown) =>
  POST(
    new Request('http://localhost/api/photo/' + encodeURIComponent(key) + '/report', {
      method: 'POST',
      ...(body !== undefined && {
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
    }),
    { params: Promise.resolve({ key }) },
  );

describe('/api/photo/[key]/report', () => {
  it('passes the report on under the name of whoever is signed in', async () => {
    server.asked = [];
    server.answer = 'recorded';
    const done = await report(KEY);
    expect(done.status).toBe(200);
    expect(await done.json()).toEqual({ reported: true });
    expect(server.asked).toHaveLength(1);
    expect(server.asked[0]).toMatchObject({ key: KEY, reporter: 'student-2' });
    expect(server.asked[0].at).toBeInstanceOf(Date);
  });

  it('takes the reporter from the session, never from what the request says', async () => {
    server.asked = [];
    await report(KEY, { reporter: 'someone-else', userId: 'someone-else' });
    expect(server.asked.map(({ reporter }) => reporter)).toEqual(['student-2']);
  });

  it('answers the same whether the report counted or not, so nothing can be learnt from it', async () => {
    server.answer = 'recorded';
    const counted = await report(KEY);
    server.answer = 'ignored';
    const ignored = await report(KEY);
    expect(ignored.status).toBe(counted.status);
    expect(await ignored.json()).toEqual(await counted.json());
  });

  it('says so when this student has reported as many as one may in a week', async () => {
    server.answer = 'too_many';
    const refused = await report(KEY);
    expect(refused.status).toBe(429);
    expect(await refused.json()).toEqual({ error: 'too_many' });
    server.answer = 'recorded';
  });

  it('does not ask the database about what could not be a key', async () => {
    server.asked = [];
    for (const key of ['', 'short', 'a'.repeat(23), 'student-1', '../../../../../etc/pwd']) {
      expect((await report(key)).status).toBe(404);
    }
    expect(server.asked).toEqual([]);
  });

  it('does nothing for someone signed out', async () => {
    server.asked = [];
    server.signedIn = false;
    expect((await report(KEY)).status).toBe(401);
    expect(server.asked).toEqual([]);
    server.signedIn = true;
  });
});
