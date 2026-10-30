import { CONFIG } from '@/lib/config';
import type { HintLevel } from './types';

/** SPEC §11. A wrong answer earns nothing, and the item is closed once it is sent. */
export function xpFor(correct: boolean, hintLevel: HintLevel): number {
  if (!correct) return 0;
  if (hintLevel === 0) return CONFIG.xp.firstTry;
  if (hintLevel === 1) return CONFIG.xp.withL1Hint;
  return CONFIG.xp.withDeepHint;
}

/** SPEC §11. A correct answer after hint L2 or L3 neither grows the combo nor breaks it. */
export function comboAfter(combo: number, correct: boolean, hintLevel: HintLevel): number {
  if (!correct) return 0;
  return hintLevel <= 1 ? combo + 1 : combo;
}
