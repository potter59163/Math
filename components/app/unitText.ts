import { th } from '@/lib/content/th';
import { fillTokens } from '@/lib/core/tokens';
import { enabledTopics, packOfUnit, unitNumberOf } from '@/lib/topics';
import type { UnitId } from '@/lib/topics/types';

/** "หน่วยที่ 1": a unit counted within its own topic, never by its id (vectors are 11–15 inside). */
export function unitName(unit: UnitId): string {
  return fillTokens(th.learn.unit, { n: String(unitNumberOf(unit)) });
}

/**
 * A passed unit on the summary and the profile, where units of every topic sit together: "ผ่านหน่วยที่ 2",
 * or "ผ่านเวกเตอร์ หน่วยที่ 1" once more than one topic is switched on.
 */
export function unitPassedName(unit: UnitId, topics: readonly string[] = enabledTopics()): string {
  const n = String(unitNumberOf(unit));
  return topics.length > 1
    ? fillTokens(th.summary.unitPassedIn, { topic: packOfUnit(unit).titleTh, n })
    : fillTokens(th.summary.unitPassed, { n });
}
