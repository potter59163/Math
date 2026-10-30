import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ALL_UNITS } from './path';
import { issueItem } from './profile';
import { PROFILE_VERSION, createProfileStore, type StorageLike } from './store';
import type { LocalStudent } from './types';

const ADA: LocalStudent = { id: 'ABC123-1', classCode: 'ABC123', seatNo: 1, units: [...ALL_UNITS] };
const BEA: LocalStudent = { id: 'ABC123-2', classCode: 'ABC123', seatNo: 2, units: [...ALL_UNITS] };

function memoryStorage(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
}

describe('createProfileStore', () => {
  let storage: ReturnType<typeof memoryStorage>;

  beforeEach(() => {
    storage = memoryStorage();
  });

  it('starts with nobody', () => {
    expect(createProfileStore(() => storage).get()).toBeNull();
  });

  it('opens a new student and remembers them across a reload', () => {
    const store = createProfileStore(() => storage);
    const opened = store.open(ADA);
    expect(opened.student).toEqual(ADA);
    expect(store.get()).toBe(opened);
    expect(createProfileStore(() => storage).get()).toEqual(opened);
  });

  it('saves progress', () => {
    const store = createProfileStore(() => storage);
    store.save({ ...store.open(ADA), xp: 40 });
    expect(createProfileStore(() => storage).get()?.xp).toBe(40);
  });

  it('keeps each student on the device apart', () => {
    const store = createProfileStore(() => storage);
    store.save({ ...store.open(ADA), xp: 40 });
    store.leave();
    expect(store.get()).toBeNull();
    expect(store.open(BEA).xp).toBe(0);
    store.leave();
    expect(store.open(ADA).xp).toBe(40);
  });

  it('applies a new unit setting to a student who comes back', () => {
    const store = createProfileStore(() => storage);
    store.save({ ...store.open(ADA), xp: 40 });
    const back = store.open({ ...ADA, units: [3] });
    expect(back.xp).toBe(40);
    expect(back.student.units).toEqual([3]);
  });

  it('keeps the open units when a student comes back with no setting', () => {
    const store = createProfileStore(() => storage);
    store.open({ ...ADA, units: [3] });
    expect(store.open(ADA, { keepUnits: true }).student.units).toEqual([3]);
  });

  it('updates the nickname of a student who comes back', () => {
    const store = createProfileStore(() => storage);
    store.open(ADA);
    expect(store.open({ ...ADA, nickname: 'มิว' }).student.nickname).toBe('มิว');
  });

  it('notifies subscribers, and stops after unsubscribing', () => {
    const store = createProfileStore(() => storage);
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    const opened = store.open(ADA);
    store.save({ ...opened, xp: 10 });
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
    store.leave();
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('returns the same snapshot until something changes', () => {
    const store = createProfileStore(() => storage);
    store.open(ADA);
    expect(store.get()).toBe(store.get());
  });

  it('ignores corrupted data', () => {
    storage.data.set('qedify:current', 'ABC123-1');
    storage.data.set('qedify:profile:ABC123-1', '{not json');
    expect(createProfileStore(() => storage).get()).toBeNull();
  });

  it('ignores a profile written by another version', () => {
    const store = createProfileStore(() => storage);
    store.open(ADA);
    const key = 'qedify:profile:ABC123-1';
    const stored = JSON.parse(storage.data.get(key)!);
    expect(stored.v).toBe(PROFILE_VERSION);
    storage.data.set(key, JSON.stringify({ ...stored, v: PROFILE_VERSION + 1 }));
    expect(createProfileStore(() => storage).get()).toBeNull();
  });

  it('keeps working in memory when storage is blocked', () => {
    const blocked = (): StorageLike => {
      throw new Error('SecurityError');
    };
    const store = createProfileStore(blocked);
    expect(store.get()).toBeNull();
    store.save(issueItem(store.open(ADA)));
    expect(store.get()?.current).toBeDefined();
  });

  it('keeps working when a write fails', () => {
    const full: StorageLike = {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
      removeItem: () => {},
    };
    const store = createProfileStore(() => full);
    const opened = store.open(ADA);
    expect(store.get()).toEqual(opened);
  });
});
