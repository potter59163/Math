import { th } from '@/lib/content/th';
import { fillTokens } from '@/lib/core/tokens';
import type { Level } from '@/lib/core/types';
import type { MisconceptionId } from '@/lib/topics/matrix/types';
import type { Candidate, PathKind, PathStep, Profile } from './types';

/** One line at 360px (AI_DIRECTOR §3.2). */
export const MAX_NOTE_UNITS = 40;

/** Written here from th.ts and never by the LLM, so it is the same in llm and rules mode. */
export function noteFor(kind: PathKind, misconception?: MisconceptionId): string {
  return fillTokens(
    th.pathNotes[kind],
    misconception && { m: th.misconceptionShort[misconception] },
  );
}

/**
 * What the strip says now: why the thing on screen is there. One decision has one note, but a compare
 * clip is followed by a probe, and "ไม่เข้าใจ" goes back to the item it left, whose reason still holds.
 */
export function stripNote({
  path,
  pending,
  current,
}: Pick<Profile, 'path' | 'pending' | 'current'>): string {
  const last = path.findLast(({ kind }) => kind !== 'request');
  if (!last) return '';
  const target = current?.ref.target;
  return last.kind === 'remediate' && !pending && target ? noteFor('probe', target) : last.note;
}

export function pathStepFor(
  { stepKind, misconception, next }: Pick<Candidate, 'stepKind' | 'misconception' | 'next'>,
  level: Level,
): PathStep {
  return { kind: stepKind, skill: next.skill, level, note: noteFor(stepKind, misconception) };
}
