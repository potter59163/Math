// The weekly board is one aggregation over every answer of the week. Each server process keeps the
// latest result of each board for a few seconds, and requests that arrive together share one query,
// so a page left polling cannot keep the database busy.

/** Long enough to soak up a burst, short enough that a student sees their new XP almost at once. */
export const BOARD_CACHE_MS = 15_000;

/** A process serves a handful of boards a week: everyone, and one per class link. */
const MAX_BOARDS = 200;

export function createBoardCache<T>(
  load: (key: string) => Promise<T>,
  { ttlMs = BOARD_CACHE_MS, now = Date.now }: { ttlMs?: number; now?: () => number } = {},
) {
  const kept = new Map<string, { at: number; value: Promise<T> }>();
  return (key: string): Promise<T> => {
    const hit = kept.get(key);
    if (hit && now() - hit.at < ttlMs) return hit.value;
    const value = load(key);
    kept.set(key, { at: now(), value });
    // A failed query is not kept, so the next request asks again.
    value.catch(() => {
      if (kept.get(key)?.value === value) kept.delete(key);
    });
    if (kept.size > MAX_BOARDS) kept.delete(kept.keys().next().value!);
    return value;
  };
}
