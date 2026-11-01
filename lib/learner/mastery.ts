import { CONFIG } from '@/lib/config';
import type { LearnerConfig, SkillState } from './types';

/**
 * Conditions 1–4 of Mastered (SPEC §7.1). The latch lives in `SkillState.passed`, so this asks only
 * about now. A skill right on the pre-test needs one clean answer until the first wrong one, and after
 * that goes "by the normal rules", as SPEC §7.1 puts it.
 */
export function meetsMastery(
  state: SkillState,
  hasOpenMisconception: boolean,
  config: LearnerConfig = CONFIG,
): boolean {
  if (hasOpenMisconception || state.pKnown < config.mastery.pKnown) return false;

  const clean = state.attempts.filter((attempt) => attempt.clean);
  const fast = state.pretestCorrect && state.attempts.every((attempt) => attempt.countsCorrect);
  const needed = fast
    ? config.mastery.minFirstTryCorrectIfPretestCorrect
    : config.mastery.minFirstTryCorrect;
  return (
    clean.length >= needed &&
    clean.some((attempt) => attempt.level >= config.mastery.minLevelToPass)
  );
}
