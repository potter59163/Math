import { describe, expect, it, vi } from 'vitest';

// The route as it runs on the server, for one signed-in student whose photo is kept in memory.
const server = vi.hoisted(() => ({
  signedIn: true as boolean,
  photo: null as { type: string; data: Uint8Array; at: string } | null,
  saved: [] as { type: string; size: number }[],
}));

vi.mock('@/lib/server/auth', () => ({
  signInConfigured: () => true,
  signedInUserId: async () => (server.signedIn ? 'student-1' : null),
}));
vi.mock('@/lib/server/db', () => ({ database: async () => ({}) }));
vi.mock('@/lib/server/store', () => ({
  createStore: () => ({
    loadPhoto: async () => server.photo,
    savePhoto: async (_userId: string, photo: { type: string; data: Uint8Array }) => {
      server.saved.push({ type: photo.type, size: photo.data.length });
      server.photo = { ...photo, at: '2026-11-25T08:00:00.000Z' };
      return server.photo.at;
    },
    deletePhoto: async () => {
      server.photo = null;
    },
  }),
}));

import { MAX_PHOTO_BYTES, MAX_PHOTO_SIDE } from '@/lib/server/photo';
import {
  jpegOf,
  pngOf,
  TINY_JPEG as JPEG,
  TINY_PNG,
  webpLossyOf,
} from '@/lib/server/photo.samples';
import { DELETE, GET, PUT } from './route';

const put = (body: Uint8Array, type = 'image/jpeg') =>
  PUT(
    new Request('http://localhost/api/photo', {
      method: 'PUT',
      headers: { 'Content-Type': type },
      body: body as BodyInit,
    }),
  );

describe('/api/photo', () => {
  it('keeps a small picture of the signed-in student, and gives it back to them alone', async () => {
    server.photo = null;
    server.saved = [];
    const saved = await put(JPEG);
    expect(saved.status).toBe(200);
    expect(await saved.json()).toEqual({ photoAt: '2026-11-25T08:00:00.000Z' });
    expect(server.saved).toEqual([{ type: 'image/jpeg', size: JPEG.length }]);

    const read = await GET();
    expect(read.status).toBe(200);
    expect(read.headers.get('content-type')).toBe('image/jpeg');
    expect(read.headers.get('x-content-type-options')).toBe('nosniff');
    expect(read.headers.get('cache-control')).toContain('private');
    expect(new Uint8Array(await read.arrayBuffer())).toEqual(JPEG);
  });

  it('takes the type from the bytes, not from what the request says', async () => {
    server.saved = [];
    const html = new TextEncoder().encode('<html><script>alert(1)</script></html>');
    expect((await put(html, 'image/jpeg')).status).toBe(415);
    expect(server.saved).toEqual([]);
  });

  it('turns away a picture too big to be the small one this device makes', async () => {
    server.saved = [];
    const big = new Uint8Array(MAX_PHOTO_BYTES + 1);
    big.set([0xff, 0xd8, 0xff]);
    expect((await put(big)).status).toBe(413);
    expect((await put(new Uint8Array())).status).toBe(400);
    expect(server.saved).toEqual([]);
  });

  it('turns away a small file that states a size no phone could draw', async () => {
    server.saved = [];
    for (const bomb of [
      jpegOf(65535, 65535),
      jpegOf(MAX_PHOTO_SIDE + 1, 16),
      pngOf(50000, 50000),
      webpLossyOf(16383, 16383),
    ]) {
      expect(bomb.length).toBeLessThan(100);
      const refused = await put(bomb);
      expect(refused.status).toBe(413);
      expect(await refused.json()).toEqual({ error: 'too_big' });
    }
    expect(server.saved).toEqual([]);
  });

  it('turns away a file that begins like a picture and states no size', async () => {
    server.saved = [];
    expect((await put(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]))).status).toBe(415);
    expect((await put(pngOf(0, 0))).status).toBe(415);
    expect(server.saved).toEqual([]);
  });

  it('keeps a picture of the size this app makes, in each kind it may come in', async () => {
    server.saved = [];
    expect((await put(jpegOf(256, 256))).status).toBe(200);
    expect((await put(TINY_PNG)).status).toBe(200);
    expect((await put(webpLossyOf(256, 256))).status).toBe(200);
    expect((await put(jpegOf(MAX_PHOTO_SIDE, MAX_PHOTO_SIDE))).status).toBe(200);
    expect(server.saved.map(({ type }) => type)).toEqual([
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/jpeg',
    ]);
  });

  it('removes the picture, and then has none to give', async () => {
    server.photo = { type: 'image/jpeg', data: JPEG, at: '2026-11-25T08:00:00.000Z' };
    const removed = await DELETE();
    expect(removed.status).toBe(200);
    expect(await removed.json()).toEqual({ photoAt: null });
    expect((await GET()).status).toBe(404);
  });

  it('does nothing for someone signed out', async () => {
    server.signedIn = false;
    expect((await GET()).status).toBe(401);
    expect((await put(JPEG)).status).toBe(401);
    expect((await DELETE()).status).toBe(401);
    server.signedIn = true;
  });
});
