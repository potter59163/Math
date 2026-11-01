import { th } from '@/lib/content/th';
import { createRng, deriveSeed } from '@/lib/core/prng';
import { tokensIn } from '@/lib/core/tokens';
import type { Answer } from '@/lib/core/types';
import type { AttemptOutcome } from '@/lib/learner/types';
import type { MatrixItem } from '@/lib/topics/matrix/types';
import { fillStudentText, resolveTokens } from './tokens';
import type { Candidate, Profile } from './types';

// What คิว says when the rules decide, so a student never gets a blank bubble and the same sentence does
// not come back every time. Which line is seeded from the student and the item count, so a reload and
// the server both land on the same one. The LLM's own words replace this when it answers.

type MessageKey = keyof typeof th.tutor.messages;

function keyFor(
  { classification, resolved, stuck }: AttemptOutcome,
  chosen: Candidate,
): MessageKey {
  if (stuck) return 'stuck';
  switch (classification.type) {
    case 'correct':
      if (resolved) return 'fixed';
      switch (chosen.stepKind) {
        case 'level_up':
          return 'level_up';
        case 'advance':
        case 'skip_clip':
          return 'advance';
        case 'review':
        case 'back':
          return 'review';
        case 'probe':
        case 'pretest_probe':
          return 'fixing';
        default:
          return 'same_level';
      }
    case 'misconception':
      return chosen.scene ? 'caught' : 'caught_again';
    case 'slip':
      return 'slip';
    default:
      return 'unknown';
  }
}

export function ruleMessage(
  profile: Pick<Profile, 'student' | 'itemsDone'>,
  item: MatrixItem,
  answer: Answer,
  outcome: AttemptOutcome,
  chosen: Candidate,
): string {
  const key = keyFor(outcome, chosen);
  const values = resolveTokens(item, answer, { revealAllowed: true });
  // Pointing at the student's own cell is worth more than a general line, whenever there is one.
  const lines: readonly string[] =
    key === 'caught' && values.studentCell !== undefined
      ? th.tutor.messages.caught_cell
      : th.tutor.messages[key];
  const usable = lines.filter((line) => tokensIn(line).every((token) => token in values));
  const rng = createRng(deriveSeed(`message:${profile.student.id}`, profile.itemsDone));
  const line = rng.pick(usable.length > 0 ? usable : th.tutor.messages.same_level);
  return fillStudentText(line, item, answer, { revealAllowed: true });
}
