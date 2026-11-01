import { newProfile } from '@/lib/director/turn';
import type { Profile } from '@/lib/director/types';
import type { LocalStudent } from '@/lib/learner/types';

// Keeps the local profile until Phase 5 moves it to the server. Storage can be missing, full or
// blocked (private windows), so every access is guarded and the app carries on in memory.

/**
 * Bump when an older Profile could be misread: it is then ignored, and that student's progress on this
 * device is gone. A new optional field read with a default does not need it.
 */
export const PROFILE_VERSION = 2;

const CURRENT_KEY = 'qedify:current';
const profileKey = (id: string) => `qedify:profile:${id}`;

export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export interface ProfileStore {
  get(): Profile | null;
  save(profile: Profile): void;
  /** Signs this student in on this device, picking up their earlier progress if there is any. */
  open(student: LocalStudent, options?: { keepUnits?: boolean }): Profile;
  leave(): void;
  subscribe(listener: () => void): () => void;
}

export function createProfileStore(getStorage: () => StorageLike): ProfileStore {
  let snapshot: Profile | null | undefined;
  const listeners = new Set<() => void>();

  const guarded = <T>(action: (storage: StorageLike) => T, fallback: T): T => {
    try {
      return action(getStorage());
    } catch {
      return fallback;
    }
  };

  const read = (id: string): Profile | null =>
    guarded((storage) => {
      const text = storage.getItem(profileKey(id));
      if (text === null) return null;
      const stored = JSON.parse(text) as { v: number; profile: Profile };
      return stored.v === PROFILE_VERSION ? stored.profile : null;
    }, null);

  const commit = (next: Profile | null) => {
    snapshot = next;
    for (const listener of listeners) listener();
  };

  const save = (profile: Profile) => {
    guarded(
      (storage) =>
        storage.setItem(
          profileKey(profile.student.id),
          JSON.stringify({ v: PROFILE_VERSION, profile }),
        ),
      undefined,
    );
    commit(profile);
  };

  return {
    // Returns the same object until something changes, as useSyncExternalStore requires.
    get: () => {
      if (snapshot === undefined) {
        const id = guarded((storage) => storage.getItem(CURRENT_KEY), null);
        snapshot = id === null ? null : read(id);
      }
      return snapshot;
    },

    save,

    open: (student, { keepUnits = false } = {}) => {
      const earlier = read(student.id);
      const profile: Profile = earlier
        ? {
            ...earlier,
            student: {
              ...student,
              nickname: student.nickname ?? earlier.student.nickname,
              units: keepUnits ? earlier.student.units : student.units,
            },
          }
        : newProfile(student);
      guarded((storage) => storage.setItem(CURRENT_KEY, student.id), undefined);
      save(profile);
      return profile;
    },

    leave: () => {
      guarded((storage) => storage.removeItem(CURRENT_KEY), undefined);
      commit(null);
    },

    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export const profileStore = createProfileStore(() => window.localStorage);
