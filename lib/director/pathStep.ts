import { th } from '@/lib/content/th';
import { fillTokens } from '@/lib/core/tokens';
import type { Level } from '@/lib/core/types';
import { misconceptionShortOf } from '@/lib/topics';
import type { MisconceptionId } from '@/lib/topics/types';
import type { Candidate, PathKind, PathStep, Profile } from './types';

/** One line at 360px (AI_DIRECTOR §3.2). */
export const MAX_NOTE_UNITS = 40;

/** Written here from th.ts and never by the LLM, so it is the same in llm and rules mode. */
export function noteFor(kind: PathKind, misconception?: MisconceptionId): string {
  return fillTokens(
    th.pathNotes[kind],
    misconception ? { m: misconceptionShortOf(misconception) } : undefined,
  );
}

type OnScreen = Pick<Profile, 'path' | 'pending' | 'current'>;

/**
 * Why the thing on screen is there. One decision has one note, but a compare clip is followed by a
 * probe, and "ไม่เข้าใจ" goes back to the item it left, whose reason still holds.
 */
function stripStep({ path, pending, current }: OnScreen): { kind: PathKind; note: string } | null {
  const last = path.findLast(({ kind }) => kind !== 'request');
  if (!last) return null;
  const target = current?.ref.target;
  return last.kind === 'remediate' && !pending && target
    ? { kind: 'probe', note: noteFor('probe', target) }
    : last;
}

/** What the strip says now. */
export function stripNote(profile: OnScreen): string {
  return stripStep(profile)?.note ?? '';
}

/** The kind of step the strip's note is about, which the strip labels when it came from the pre-test. */
export function stripKind(profile: OnScreen): PathKind | null {
  return stripStep(profile)?.kind ?? null;
}

export function pathStepFor(
  { stepKind, misconception, next }: Pick<Candidate, 'stepKind' | 'misconception' | 'next'>,
  level: Level,
): PathStep {
  return { kind: stepKind, skill: next.skill, level, note: noteFor(stepKind, misconception) };
}
