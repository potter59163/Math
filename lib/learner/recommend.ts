import { activeTopicOf, packOf } from '@/lib/topics';
import type { MisconceptionId, SkillId } from '@/lib/topics/types';
import { isOpen } from './misconceptionStatus';
import { nextSkill } from './progress';
import type { LearnerProfile } from './types';

// What the home screen suggests. It reads the same profile the director does, so a student opens the
// app to a sentence about themselves. The director still decides what really happens next. It speaks
// about the topic the student is learning.

export type Recommendation =
  | { kind: 'start' | 'next' | 'carryOn' | 'stuck'; skill: SkillId }
  | { kind: 'fix'; misconception: MisconceptionId }
  | { kind: 'done' };

export function recommendationFor(profile: LearnerProfile): Recommendation {
  const pack = packOf(activeTopicOf(profile.student));
  const skill = nextSkill(profile, pack.id);
  if (skill === null) return { kind: 'done' };
  if (profile.itemsDone === 0) return { kind: 'start', skill };

  // A pre-test flag on a skill not started is waiting for that skill, so it is not "still open" yet.
  const fixing = pack.catalog.find(
    ({ id, skills }) =>
      isOpen(profile.misconceptions[id]) &&
      skills.some((owner) => (profile.skills[owner]?.attempts.length ?? 0) > 0),
  );
  if (fixing) return { kind: 'fix', misconception: pack.catalogEntry(fixing.id).id };

  const stuck = pack.skills.find(({ id }) => profile.skills[id]?.stuck);
  if (stuck) return { kind: 'stuck', skill: stuck.id };

  return (profile.skills[skill]?.attempts.length ?? 0) > 0
    ? { kind: 'carryOn', skill }
    : { kind: 'next', skill };
}
