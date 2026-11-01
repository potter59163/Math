import { describe, expect, it } from 'vitest';
import { MAX_SCENE_VIEWS, createSceneLog, type SceneViewRecord } from './sceneLog';
import type { StorageLike } from './store';

function memoryStorage(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
}

const VIEW: SceneViewRecord = {
  studentId: 'ABC123-1',
  decisionId: null,
  template: 'row_col_dot',
  purpose: 'remediate',
  beatsTotal: 8,
  beatsSeen: 8,
  replays: 1,
  skipped: false,
  durationMs: 21000,
  createdAt: '2026-11-01T10:00:00.000Z',
};

describe('createSceneLog', () => {
  it('keeps the fields of scene_views on this device', () => {
    const storage = memoryStorage();
    createSceneLog(() => storage).add(VIEW);
    expect(createSceneLog(() => storage).all('ABC123-1')).toEqual([VIEW]);
    expect([...storage.data.keys()]).toEqual(['math:scene-views:ABC123-1']);
  });

  it('keeps each student apart, and leaves the profile alone', () => {
    const storage = memoryStorage();
    const log = createSceneLog(() => storage);
    log.add(VIEW);
    log.add({ ...VIEW, studentId: 'ABC123-2' });
    expect(log.all('ABC123-1')).toHaveLength(1);
    expect(log.all('ABC123-2')).toHaveLength(1);
    expect(log.all('ABC123-3')).toEqual([]);
    expect([...storage.data.keys()].some((key) => key.startsWith('math:profile'))).toBe(false);
  });

  it('keeps only the newest views, so storage cannot fill up', () => {
    const storage = memoryStorage();
    const log = createSceneLog(() => storage);
    for (let i = 0; i < MAX_SCENE_VIEWS + 5; i += 1) log.add({ ...VIEW, durationMs: i });
    const views = log.all('ABC123-1');
    expect(views).toHaveLength(MAX_SCENE_VIEWS);
    expect(views[0].durationMs).toBe(5);
    expect(views.at(-1)?.durationMs).toBe(MAX_SCENE_VIEWS + 4);
  });

  it('ignores corrupted data', () => {
    const storage = memoryStorage();
    storage.data.set('math:scene-views:ABC123-1', '{not json');
    const log = createSceneLog(() => storage);
    expect(log.all('ABC123-1')).toEqual([]);
    log.add(VIEW);
    expect(log.all('ABC123-1')).toEqual([VIEW]);
  });

  it('carries on when storage is blocked or full', () => {
    const blocked = createSceneLog(() => {
      throw new Error('SecurityError');
    });
    expect(() => blocked.add(VIEW)).not.toThrow();
    expect(blocked.all('ABC123-1')).toEqual([]);

    const full = createSceneLog(() => ({
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
      removeItem: () => {},
    }));
    expect(() => full.add(VIEW)).not.toThrow();
  });
});
