import { activeTopicOf, packOf } from '@/lib/topics';
import type { MisconceptionId, SkillId } from '@/lib/topics/types';
import { isOpen } from './misconceptionStatus';
import { hasPretestMarks, pretestSummaryOf, skillStartOf, type StartKind } from './pretest';
import { itemsDoneIn, nextSkill } from './progress';
import type { LearnerProfile } from './types';

// What the home screen suggests. It reads the same profile the director does, so a student opens the
// app to a sentence about themselves. The director still decides what really happens next. It speaks
// about the topic the student is learning, and counts only that topic's items.

export type Recommendation =
  | { kind: 'start' | 'next' | 'carryOn' | 'stuck' | 'nextQuick'; skill: SkillId }
  | { kind: 'nextCheck'; skill: SkillId; misconception: MisconceptionId }
  | { kind: 'fix'; misconception: MisconceptionId }
  | {
      /** The first visit after the pre-test, which says what the test changed (SPEC §4). */
      kind: 'pretest';
      skill: SkillId;
      start: StartKind;
      /** Skills right on the pre-test. */
      known: number;
      misconception?: MisconceptionId;
    }
  | { kind: 'done' };

export function recommendationFor(profile: LearnerProfile): Recommendation {
  const pack = packOf(activeTopicOf(profile.student));
  const skill = nextSkill(profile, pack.id);
  if (skill === null) return { kind: 'done' };

  if (itemsDoneIn(profile, pack.id) === 0) {
    if (!hasPretestMarks(profile, pack.id)) return { kind: 'start', skill };
    const { kind, misconception } = skillStartOf(profile, skill);
    return {
      kind: 'pretest',
      skill,
      start: kind,
      known: pretestSummaryOf(profile, pack.id).known.length,
      ...(misconception && { misconception }),
    };
  }

  // A pre-test flag on a skill not started is waiting for that skill, so it is not "still open" yet.
  const fixing = pack.catalog.find(
    ({ id, skills }) =>
      isOpen(profile.misconceptions[id]) &&
      skills.some((owner) => (profile.skills[owner]?.attempts.length ?? 0) > 0),
  );
  if (fixing) return { kind: 'fix', misconception: pack.catalogEntry(fixing.id).id };

  const stuck = pack.skills.find(({ id }) => profile.skills[id]?.stuck);
  if (stuck) return { kind: 'stuck', skill: stuck.id };

  if ((profile.skills[skill]?.attempts.length ?? 0) > 0) return { kind: 'carryOn', skill };
  const { kind, misconception } = skillStartOf(profile, skill);
  if (kind === 'check' && misconception) return { kind: 'nextCheck', skill, misconception };
  return { kind: kind === 'quick' ? 'nextQuick' : 'next', skill };
}
