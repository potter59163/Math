import type { StorageLike } from './learner';

// The photos this student reported from this device, by their keys. The server counts a student once
// however often they ask; this list only lets the board stop drawing those photos for them, at once
// and after a reload, since one report alone takes nothing down.

/** More than a student may report in months, and little enough to read on every visit to the board. */
const MAX_KEPT = 60;

const keyOf = (student: string) => `math:reported:${student}`;

/** The browser's own storage. Reaching for it can itself be refused, and then nothing is kept. */
export function deviceStorage(): StorageLike {
  try {
    return window.localStorage;
  } catch {
    return { getItem: () => null, setItem: () => {}, removeItem: () => {} };
  }
}

export function reportedPhotos(storage: StorageLike, student: string): string[] {
  try {
    const kept: unknown = JSON.parse(storage.getItem(keyOf(student)) ?? '[]');
    return Array.isArray(kept) && kept.every((key) => typeof key === 'string') ? kept : [];
  } catch {
    return [];
  }
}

export function rememberReported(storage: StorageLike, student: string, photo: string): string[] {
  const kept = [...new Set([...reportedPhotos(storage, student), photo])].slice(-MAX_KEPT);
  try {
    storage.setItem(keyOf(student), JSON.stringify(kept));
  } catch {
    // A device that will not store it draws the photo again after a reload, and nothing worse.
  }
  return kept;
}
