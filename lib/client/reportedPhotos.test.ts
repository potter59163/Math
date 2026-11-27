import { describe, expect, it } from 'vitest';
import type { StorageLike } from './learner';
import { rememberReported, reportedPhotos } from './reportedPhotos';

function memoryStorage(
  start: Record<string, string> = {},
): StorageLike & { data: Map<string, string> } {
  const data = new Map(Object.entries(start));
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
}

describe('the photos a student reported from this device', () => {
  it('are remembered for that student, once each, and for nobody else', () => {
    const storage = memoryStorage();
    expect(reportedPhotos(storage, 'me')).toEqual([]);
    expect(rememberReported(storage, 'me', 'key-1')).toEqual(['key-1']);
    expect(rememberReported(storage, 'me', 'key-2')).toEqual(['key-1', 'key-2']);
    expect(rememberReported(storage, 'me', 'key-1')).toEqual(['key-1', 'key-2']);
    expect(reportedPhotos(storage, 'me')).toEqual(['key-1', 'key-2']);
    expect(reportedPhotos(storage, 'someone-else')).toEqual([]);
  });

  it('do not grow without end', () => {
    const storage = memoryStorage();
    for (let n = 0; n < 200; n += 1) rememberReported(storage, 'me', 'key-' + n);
    const kept = reportedPhotos(storage, 'me');
    expect(kept.length).toBeLessThanOrEqual(100);
    expect(kept.at(-1)).toBe('key-199');
  });

  it('are none when what is stored is not a list of keys', () => {
    for (const stored of ['not json', '{"a":1}', '[1,2,{"x":3}]', 'null']) {
      const storage = memoryStorage({ 'math:reported:me': stored });
      expect(reportedPhotos(storage, 'me')).toEqual([]);
      expect(rememberReported(storage, 'me', 'key-1')).toEqual(['key-1']);
    }
  });

  it('still answer when the device will not store anything', () => {
    const closed: StorageLike = {
      getItem: () => {
        throw new Error('closed');
      },
      setItem: () => {
        throw new Error('closed');
      },
      removeItem: () => {},
    };
    expect(reportedPhotos(closed, 'me')).toEqual([]);
    expect(rememberReported(closed, 'me', 'key-1')).toEqual(['key-1']);
  });
});
