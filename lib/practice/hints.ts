import type { Item } from '@/lib/core/types';
import { packOf } from '@/lib/topics';
import type { MisconceptionId } from '@/lib/topics/types';

export interface Hint {
  level: 1 | 2 | 3;
  text: string;
  /** Only hint L3 shows a worked step. */
  latex?: string;
}

/** SPEC §9, L2: an open misconception (§7.2) this item can test, else the first step. */
function pointingHint(item: Item, open: readonly MisconceptionId[]): string {
  const pack = packOf(item.ref.topic);
  const known = item.diagnostics.find(({ id }) => open.includes(id));
  if (known) return pack.copy.misconceptionHint(known.id);
  return pack.hints.firstStep(item);
}

/**
 * The hint at one level of the ladder (SPEC §9). All wording comes from th.ts through the item's topic
 * pack, never an LLM. `open` is the suspected and active misconceptions.
 */
export function hintAt(item: Item, level: Hint['level'], open: readonly MisconceptionId[]): Hint {
  if (level === 1) return { level, text: packOf(item.ref.topic).hints.l1(item) };
  if (level === 2) return { level, text: pointingHint(item, open) };
  const { text, latex } = packOf(item.ref.topic).hints.step(item);
  return { level, text, latex };
}
