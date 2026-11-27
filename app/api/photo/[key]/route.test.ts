import { describe, expect, it, vi } from 'vitest';

// The route as it runs on the server, for a signed-in student looking at the board. Which pictures are
// shown, and under which keys, is the store's business (lib/server/store.test.ts): here it is a map.
const server = vi.hoisted(() => ({
  signedIn: true as boolean,
  shown: new Map<string, { type: string; data: Uint8Array }>(),
  asked: [] as string[],
}));

vi.mock('@/lib/server/auth', () => ({
  signInConfigured: () => true,
  signedInUserId: async () => (server.signedIn ? 'student-2' : null),
}));
vi.mock('@/lib/server/db', () => ({ database: async () => ({}) }));
vi.mock('@/lib/server/store', () => ({
  createStore: () => ({
    loadSharedPhoto: async (key: string) => {
      server.asked.push(key);
      return server.shown.get(key) ?? null;
    },
  }),
}));

import { jpegOf, TINY_JPEG as JPEG } from '@/lib/server/photo.samples';
import { GET } from './route';
const KEY = 'AbCdEfGhIjKlMnOpQrSt_-';

const get = (key: string) =>
  GET(new Request('http://localhost/api/photo/' + encodeURIComponent(key)), {
    params: Promise.resolve({ key }),
  });

describe('/api/photo/[key]', () => {
  it('gives a signed-in student a picture its owner chose to show', async () => {
    server.shown.set(KEY, { type: 'image/jpeg', data: JPEG });
    const read = await get(KEY);
    expect(read.status).toBe(200);
    expect(read.headers.get('content-type')).toBe('image/jpeg');
    expect(read.headers.get('x-content-type-options')).toBe('nosniff');
    expect(read.headers.get('content-security-policy')).toBe("default-src 'none'");
    expect(new Uint8Array(await read.arrayBuffer())).toEqual(JPEG);
  });

  it('lets only that browser keep it, and not for long, so switching it off soon shows', async () => {
    server.shown.set(KEY, { type: 'image/jpeg', data: JPEG });
    const kept = (await get(KEY)).headers.get('cache-control') ?? '';
    expect(kept).toContain('private');
    expect(kept).not.toContain('public');
    const seconds = Number(/max-age=(\d+)/.exec(kept)?.[1]);
    expect(seconds).toBeGreaterThan(0);
    expect(seconds).toBeLessThanOrEqual(600);
  });

  it('has nothing under a key that is not shown, or no longer', async () => {
    server.shown.clear();
    const gone = await get(KEY);
    expect(gone.status).toBe(404);
    expect(gone.headers.get('cache-control') ?? '').not.toContain('max-age');
  });

  it('hands on nothing that states a size a phone could not draw, however it came to be stored', async () => {
    server.shown.set(KEY, { type: 'image/jpeg', data: jpegOf(65535, 65535) });
    expect((await get(KEY)).status).toBe(404);
    server.shown.set(KEY, {
      type: 'image/jpeg',
      data: new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2]),
    });
    expect((await get(KEY)).status).toBe(404);
    server.shown.set(KEY, { type: 'image/jpeg', data: jpegOf(256, 256) });
    expect((await get(KEY)).status).toBe(200);
  });

  it('does not ask the database about what could not be a key', async () => {
    server.asked = [];
    for (const key of ['', 'short', 'a'.repeat(23), 'student-1', '../../../../../etc/pwd']) {
      expect((await get(key)).status).toBe(404);
    }
    expect(server.asked).toEqual([]);
  });

  it('shows nothing to someone signed out', async () => {
    server.shown.set(KEY, { type: 'image/jpeg', data: JPEG });
    server.signedIn = false;
    expect((await get(KEY)).status).toBe(401);
    server.signedIn = true;
  });
});
