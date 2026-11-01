import { CONFIG } from '@/lib/config';
import { isUnitPassed } from '@/lib/learner/progress';
import type { HintLevel, LearnerProfile, UnitId } from '@/lib/learner/types';

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

export type Badge = { kind: 'unit'; unit: UnitId } | { kind: 'fixed' };

/** SPEC §11. A badge stays once earned: a later relapse does not take back a fix that happened. */
export function badgesOf(
  profile: Pick<LearnerProfile, 'student' | 'skills' | 'misconceptions'>,
): Badge[] {
  const units = [...profile.student.units]
    .sort((a, b) => a - b)
    .filter((unit) => isUnitPassed(profile, unit))
    .map((unit): Badge => ({ kind: 'unit', unit }));
  const fixedOne = Object.values(profile.misconceptions).some((state) => state.rewarded);
  return fixedOne ? [...units, { kind: 'fixed' }] : units;
}
