import { CONFIG } from '@/lib/config';
import type { Level } from '@/lib/core/types';
import type { FirstAttempt, LearnerConfig } from './types';

/** `rolling` of SPEC §7.3: the share counted as right among the latest first attempts in the skill. */
export function rollingRate(attempts: FirstAttempt[], config: LearnerConfig = CONFIG): number {
  const recent = attempts.slice(-config.difficulty.window);
  if (recent.length === 0) return 0;
  return recent.filter(({ countsCorrect }) => countsCorrect).length / recent.length;
}

/** The level of the skill after its latest attempt, one step at most (SPEC §7.3). */
export function nextLevel(
  level: Level,
  attempts: FirstAttempt[],
  pKnown: number,
  maxLevel: Level,
  config: LearnerConfig = CONFIG,
): Level {
  if (attempts.length === 0) return level;
  const { upAt, downAt, minAttemptsAtLevel } = config.difficulty;
  const rolling = rollingRate(attempts, config);

  if (!attempts[attempts.length - 1].countsCorrect) {
    return rolling <= downAt && level > 1 ? ((level - 1) as Level) : level;
  }
  if (level >= maxLevel) return level;
  const doneHere = attempts.filter((attempt) => attempt.level === level).length;
  const steady = rolling >= upAt && doneHere >= minAttemptsAtLevel;
  const sureOfL1 = level === 1 && pKnown >= config.mastery.pKnown;
  return steady || sureOfL1 ? ((level + 1) as Level) : level;
}
