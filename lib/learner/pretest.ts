import { packOf } from '@/lib/topics';
import type { MisconceptionId, SkillId, TopicId } from '@/lib/topics/types';
import { openMisconceptions } from './profile';
import { hasPassed, inOpenUnit, nextSkill } from './progress';
import type { LearnerProfile } from './types';

// What the pre-test changed for one student, read back from their profile (SPEC §4, §7.1). The flags
// read here are written by `applyPretest` and never cleared, so the same summary can be shown right
// after the test and at any later visit, with what has happened since. Pure, like the rest of the
// learner model: it only reads what the director already acts on, and decides nothing itself.

type Progress = Pick<LearnerProfile, 'student' | 'skills' | 'misconceptions'>;

/** What entering a skill will be like: a quick check, a check of a mistake first, or a new lesson. */
export type StartKind = 'quick' | 'check' | 'learn';

export interface SkillStart {
  kind: StartKind;
  /** For `check`: the mistake the first item is aimed at. */
  misconception?: MisconceptionId;
}

export interface PretestSummary {
  /** Right on the pre-test: no lead clip, starts at L2, and one right answer passes it. */
  known: { skill: SkillId; passed: boolean }[];
  /** Caught on the pre-test, each with the skill it is about: the last of its skills in teaching order. */
  caught: { misconception: MisconceptionId; skill: SkillId; fixed: boolean }[];
  /** The rest of the open skills: taught as usual, starting with the lead clip. */
  toLearn: { skill: SkillId; passed: boolean }[];
  /** The skill the director opens next and what it will be like. Null once every skill has passed. */
  start: ({ skill: SkillId } & SkillStart) | null;
}

/** Right on the pre-test and not passed yet: one right answer will pass it (SPEC §7.1). */
export function isQuickCheck(profile: Pick<LearnerProfile, 'skills'>, skill: SkillId): boolean {
  const state = profile.skills[skill];
  return state?.pretestCorrect === true && !state.passed;
}

/**
 * A mistake from the pre-test still waiting in a skill not started yet: its first item will be a probe
 * aimed at it, as `enterSkill` does. The latest caught wins and ties keep catalog order, the same choice.
 */
export function pretestCheckOf(
  profile: Pick<LearnerProfile, 'skills' | 'misconceptions'>,
  skill: SkillId,
): MisconceptionId | null {
  if ((profile.skills[skill]?.attempts.length ?? 0) > 0) return null;
  const waiting = openMisconceptions(profile, skill).filter(
    (id) => profile.misconceptions[id]?.fromPretest === true,
  );
  return latestCaught(profile, waiting);
}

function latestCaught(
  profile: Pick<LearnerProfile, 'misconceptions'>,
  ids: readonly MisconceptionId[],
): MisconceptionId | null {
  const caughtAt = (id: MisconceptionId) => profile.misconceptions[id]?.lastCaughtAtItem ?? 0;
  return ids.reduce<MisconceptionId | null>(
    (best, id) => (best === null || caughtAt(id) > caughtAt(best) ? id : best),
    null,
  );
}

/**
 * What going into a skill will be like for this student, by the rule the director follows when it
 * enters one: a probe if a mistake is open there, otherwise a quick check if the pre-test got it right,
 * otherwise the lead clip and a first item.
 */
export function skillStartOf(
  profile: Pick<LearnerProfile, 'skills' | 'misconceptions'>,
  skill: SkillId,
): SkillStart {
  const open = latestCaught(profile, openMisconceptions(profile, skill));
  if (open) return { kind: 'check', misconception: open };
  return { kind: isQuickCheck(profile, skill) ? 'quick' : 'learn' };
}

/**
 * The skill a misconception is named after. One that more than one skill can show (M11 in `mult` and
 * `mult_noncomm`) is about the later of them, which builds on the earlier.
 */
function skillAbout(topic: TopicId, misconception: MisconceptionId): SkillId {
  const pack = packOf(topic);
  const { skills } = pack.catalogEntry(misconception);
  return pack.skills.findLast(({ id }) => skills.includes(id))?.id ?? skills[0];
}

export function pretestSummaryOf(profile: Progress, topic: TopicId): PretestSummary {
  const pack = packOf(topic);
  const open = pack.skills.filter(({ id }) => inOpenUnit(profile, id)).map(({ id }) => id);

  const known = open
    .filter((skill) => profile.skills[skill]?.pretestCorrect === true)
    .map((skill) => ({ skill, passed: hasPassed(profile, skill) }));

  const caught = pack.catalog
    .filter(({ id }) => profile.misconceptions[id]?.fromPretest === true)
    .map(({ id }) => ({
      misconception: id,
      skill: skillAbout(topic, id),
      fixed: profile.misconceptions[id]?.status === 'resolved',
    }))
    .filter(({ skill }) => open.includes(skill));

  // Every skill that can check a caught mistake starts with that check, so none of them is plain learning.
  const listed = new Set<SkillId>([
    ...known.map(({ skill }) => skill),
    ...caught.flatMap(({ misconception }) => pack.catalogEntry(misconception).skills),
  ]);
  const toLearn = open
    .filter((skill) => !listed.has(skill))
    .map((skill) => ({ skill, passed: hasPassed(profile, skill) }));

  const next = nextSkill(profile, topic);
  return {
    known,
    caught,
    toLearn,
    start: next === null ? null : { skill: next, ...skillStartOf(profile, next) },
  };
}

/** The pre-test left something this topic's screens should show: a skill known or a mistake caught. */
export function hasPretestMarks(profile: Progress, topic: TopicId): boolean {
  const { known, caught } = pretestSummaryOf(profile, topic);
  return known.length > 0 || caught.length > 0;
}
