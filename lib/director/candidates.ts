import { CONFIG } from '@/lib/config';
import { th } from '@/lib/content/th';
import { storeAnswer } from '@/lib/core/answerJson';
import { fillTokens } from '@/lib/core/tokens';
import type { Answer, Level } from '@/lib/core/types';
import { longestUnseen, REVIEW_LEVEL, reviewDue } from '@/lib/learner/interleave';
import {
  isFixingMisconception,
  levelOf,
  openMisconceptions,
  skillStateOf,
} from '@/lib/learner/profile';
import { hasPassed, isUnlocked, nextSkill } from '@/lib/learner/progress';
import type { AttemptOutcome, LearnerProfile } from '@/lib/learner/types';
import { probeLevel, probeLevels } from '@/lib/topics/matrix/misconceptions';
import { exampleSeed } from '@/lib/topics/matrix/scenes';
import { SKILLS, skillById, type SkillId } from '@/lib/topics/matrix/skills';
import type { MatrixItem, MisconceptionId } from '@/lib/topics/matrix/types';
import { drawItem } from './items';
import { chosenScene, helpRequest, leadClip, needsLeadClip } from './scene';
import type { Candidate, CandidateId, ChosenScene, NextStep, PathKind } from './types';

// The rules of AI_DIRECTOR §3. They propose; `rules.ts` or the LLM of Phase 6 chooses. Everything here
// is pure and spends nothing: the seed of the next item is drawn only once a candidate is chosen.

const SCORE = {
  stuck: 0.97,
  review: 0.95,
  sceneThenProbe: 0.9,
  probeAfterScenes: 0.92,
  probeOnly: 0.7,
  workedThenProbe: 0.6,
  slip: 0.8,
  slipWithHint: 0.5,
  workedThenEasier: 0.8,
  conceptThenSame: 0.6,
  advance: 0.9,
  challenge: 0.5,
  probeAgain: 0.85,
  practice: 0.8,
  /** session_start, student_request and the fixed path have no competing rule to rank against. */
  only: 1,
} as const;

/** R1: after this many views of its scene, testing beats playing it again. */
const SCENES_BEFORE_PROBE_ONLY = 2;

const CHALLENGE_LEVEL: Level = 3;

/** The answer that was just sent, on a profile that already includes it. */
export interface AttemptContext {
  item: MatrixItem;
  answer: Answer;
  outcome: AttemptOutcome;
}

export type DraftCandidate = Omit<Candidate, 'id'>;

const reason = (key: keyof typeof th.ruleReasons, params?: Record<string, string>): string =>
  fillTokens(th.ruleReasons[key], params);

const skillName = (id: SkillId): string => skillById(id).nameTh;

const shortName = (id: MisconceptionId): string => th.misconceptionShort[id];

function itemStep(skill: SkillId, level: Level, hintLevel?: 1): NextStep {
  return { skill, level, purpose: 'practice', ...(hintLevel && { hintLevel }) };
}

/**
 * Every target gets its level from probeLevel (MISCONCEPTIONS §4.1). A variant this skill cannot show
 * widens to the whole misconception, and a misconception it cannot show at all becomes a plain item.
 */
export function probeStep(
  skill: SkillId,
  level: Level,
  target: MisconceptionId,
  targetVariant?: string,
): NextStep {
  if (probeLevels(skill, target, targetVariant).length > 0) {
    return {
      skill,
      level: probeLevel(skill, target, level, targetVariant),
      purpose: 'probe',
      target,
      ...(targetVariant !== undefined && { targetVariant }),
    };
  }
  return targetVariant === undefined ? itemStep(skill, level) : probeStep(skill, level, target);
}

/** The open one caught most recently. Ties keep catalog order. */
function latestOpen(profile: LearnerProfile, skill: SkillId): MisconceptionId | null {
  const caughtAt = (id: MisconceptionId) => profile.misconceptions[id]?.lastCaughtAtItem ?? 0;
  const open = openMisconceptions(profile, skill);
  if (open.length === 0) return null;
  return open.reduce((best, id) => (caughtAt(id) > caughtAt(best) ? id : best));
}

function probeOf(profile: LearnerProfile, skill: SkillId, id: MisconceptionId): NextStep {
  return probeStep(skill, levelOf(profile, skill), id, profile.misconceptions[id]?.variant);
}

function isPretestOnly(profile: LearnerProfile, id: MisconceptionId): boolean {
  const state = profile.misconceptions[id];
  return state?.fromPretest === true && state.count === 1;
}

function levelKind({ levelChange }: AttemptOutcome): PathKind {
  if (levelChange > 0) return 'level_up';
  return levelChange < 0 ? 'level_down' : 'same_level';
}

const NOTE_WITHOUT_SCENE: Partial<Record<PathKind, PathKind>> = {
  remediate: 'probe',
  worked: 'same_level',
  concept: 'same_level',
};

/** A clip that cannot be built is dropped, and the note must not promise it (SPEC §4). */
function withScene(draft: DraftCandidate, scene: ChosenScene | undefined): DraftCandidate {
  if (scene) return { ...draft, scene };
  return { ...draft, stepKind: NOTE_WITHOUT_SCENE[draft.stepKind] ?? draft.stepKind };
}

/** Best first, with no two the same, at most 4 (AI_DIRECTOR §3). A single path stays single. */
export function finalizeCandidates(drafts: DraftCandidate[]): Candidate[] {
  const seen = new Set<string>();
  return [...drafts]
    .sort((a, b) => b.score - a.score)
    .filter((draft) => {
      const key = `${draft.scene?.template ?? ''}|${JSON.stringify(draft.next)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, CONFIG.llm.maxCandidates)
    .map((draft, index) => ({ ...draft, id: `c${index + 1}` as CandidateId }));
}

function workedThen(ref: MatrixItem['ref'], next: NextStep, draft: Omit<DraftCandidate, 'next'>) {
  return withScene({ ...draft, next }, chosenScene({ kind: 'reveal', ref }));
}

/** R7, on the attempt that made the streak reach 3 (SPEC §7.5). */
function stuckRule({ item, outcome }: AttemptContext): DraftCandidate[] {
  if (!outcome.stuck) return [];
  return [
    workedThen(item.ref, itemStep(item.ref.skill, 1), {
      rule: 'R7',
      score: SCORE.stuck,
      stepKind: 'worked',
      ruleReason: reason('stuck', { n: String(CONFIG.stuckAfterWrong) }),
    }),
  ];
}

/** R6 (SPEC §7.4). */
function reviewRule(profile: LearnerProfile, { outcome }: AttemptContext): DraftCandidate[] {
  if (outcome.classification.type !== 'correct' || isFixingMisconception(profile)) return [];
  const due = reviewDue(profile);
  if (due === null) return [];
  return [
    {
      rule: 'R6',
      score: SCORE.review,
      next: { skill: due, level: REVIEW_LEVEL, purpose: 'review' },
      stepKind: 'review',
      ruleReason: reason('review', {
        skill: skillName(due),
        n: String(profile.itemsDone - skillStateOf(profile, due).lastSeen),
      }),
    },
  ];
}

/** R1: the rest of the lesson is this misconception until it is fixed. */
function misconceptionRule(
  profile: LearnerProfile,
  { item, answer }: AttemptContext,
  id: MisconceptionId,
  variant: string | undefined,
): DraftCandidate[] {
  const s = item.ref.skill;
  const L = levelOf(profile, s);
  const state = profile.misconceptions[id];
  const views = state?.scenesSeen ?? 0;
  const seenEnough = views >= SCENES_BEFORE_PROBE_ONLY;
  const m = shortName(id);
  const probe = probeStep(s, L, id, variant);
  const easier = probeStep(s, Math.max(L - 1, 1) as Level, id, variant);
  const compare = chosenScene({
    kind: 'remediate',
    ref: item.ref,
    answer: storeAnswer(answer),
    caught: { id, variant },
  });

  return [
    withScene(
      {
        rule: 'R1',
        score: SCORE.sceneThenProbe,
        next: probe,
        stepKind: 'remediate',
        misconception: id,
        ruleReason: reason('scene_then_probe', { m, n: String(state?.count ?? 1) }),
      },
      compare,
    ),
    {
      rule: 'R1',
      score: seenEnough ? SCORE.probeAfterScenes : SCORE.probeOnly,
      next: probe,
      stepKind: 'probe',
      misconception: id,
      ruleReason: seenEnough
        ? reason('probe_after_scenes', { m, n: String(views) })
        : reason('probe_only', { m }),
    },
    workedThen(item.ref, easier, {
      rule: 'R1',
      score: SCORE.workedThenProbe,
      stepKind: 'worked',
      misconception: id,
      ruleReason: reason('worked_then_probe', { m }),
    }),
  ];
}

/** R2. */
function slipRule(profile: LearnerProfile, { item, outcome }: AttemptContext): DraftCandidate[] {
  const s = item.ref.skill;
  const L = levelOf(profile, s);
  return [
    {
      rule: 'R2',
      score: SCORE.slip,
      next: itemStep(s, L),
      stepKind: levelKind(outcome),
      ruleReason: reason('slip'),
    },
    {
      rule: 'R2',
      score: SCORE.slipWithHint,
      next: itemStep(s, L, 1),
      stepKind: levelKind(outcome),
      ruleReason: reason('slip_with_hint'),
    },
  ];
}

/** R3. The easier item is for this once: the level of the skill moves only by SPEC §7.3. */
function unknownRule(profile: LearnerProfile, { item }: AttemptContext): DraftCandidate[] {
  const s = item.ref.skill;
  const L = levelOf(profile, s);
  const same = itemStep(s, L);
  const upcoming = drawItem(profile, same).item;
  return [
    workedThen(item.ref, itemStep(s, Math.max(L - 1, 1) as Level), {
      rule: 'R3',
      score: SCORE.workedThenEasier,
      stepKind: 'worked',
      ruleReason: reason('worked_then_easier'),
    }),
    withScene(
      {
        rule: 'R3',
        score: SCORE.conceptThenSame,
        next: same,
        stepKind: 'concept',
        ruleReason: reason('concept_then_same'),
      },
      chosenScene({
        kind: 'concept',
        skill: s,
        seed: exampleSeed(`${item.ref.seed}:concept`, 0),
        level: L,
        avoid: upcoming.ref,
        purpose: 'concept',
      }),
    ),
  ];
}

/**
 * What going to a skill means: a probe if the pre-test flagged it (AI_DIRECTOR §2), its lead clip if it
 * is new, and a note that says whether this is new ground or a return from a review.
 */
function enterSkill(
  profile: LearnerProfile,
  skill: SkillId,
): Pick<DraftCandidate, 'next' | 'stepKind' | 'misconception' | 'scene'> {
  const open = latestOpen(profile, skill);
  const next = open ? probeOf(profile, skill, open) : itemStep(skill, levelOf(profile, skill));
  const state = skillStateOf(profile, skill);
  const scene = needsLeadClip(profile, skill) ? leadClip(profile, next) : undefined;
  const shared = { next, ...(scene && { scene }) };

  if (open) {
    const stepKind: PathKind = isPretestOnly(profile, open) ? 'pretest_probe' : 'probe';
    return { ...shared, stepKind, misconception: open };
  }
  if (state.attempts.length > 0) return { ...shared, stepKind: 'back' };
  const skippedClip = state.pretestCorrect && !profile.clipsSeen.includes(skill);
  return { ...shared, stepKind: skippedClip ? 'skip_clip' : 'advance' };
}

/** R4. */
function passedRule(profile: LearnerProfile, { item }: AttemptContext): DraftCandidate[] {
  const s = item.ref.skill;
  const following = nextSkill(profile);
  const challenge: DraftCandidate[] =
    skillById(s).maxLevel >= CHALLENGE_LEVEL
      ? [
          {
            rule: 'R4',
            score: SCORE.challenge,
            next: { skill: s, level: CHALLENGE_LEVEL, purpose: 'challenge' },
            stepKind: 'level_up',
            ruleReason: reason('challenge', {
              skill: skillName(s),
              level: String(CHALLENGE_LEVEL),
            }),
          },
        ]
      : [];

  if (following !== null) {
    return [
      {
        rule: 'R4',
        score: SCORE.advance,
        ...enterSkill(profile, following),
        ruleReason: reason('advance', { skill: skillName(s), next: skillName(following) }),
      },
      ...challenge,
    ];
  }
  // Nothing left to learn, but there is still time in the period (SPEC §7.4, PLAN Phase 4).
  const oldest = longestUnseen(profile) ?? s;
  return [
    {
      rule: 'R4',
      score: SCORE.advance,
      next: { skill: oldest, level: REVIEW_LEVEL, purpose: 'review' },
      stepKind: 'review',
      ruleReason: reason('all_passed', { skill: skillName(oldest) }),
    },
    ...challenge,
  ];
}

/** R5. */
function notYetRule(
  profile: LearnerProfile,
  { item, outcome }: AttemptContext,
  open: MisconceptionId | null,
): DraftCandidate[] {
  const s = item.ref.skill;
  const L = levelOf(profile, s);
  const practice: DraftCandidate = {
    rule: 'R5',
    score: SCORE.practice,
    next: itemStep(s, L),
    stepKind: levelKind(outcome),
    ruleReason: reason('practice', { skill: skillName(s), level: String(L) }),
  };
  if (open === null) return [practice];
  return [
    {
      rule: 'R5',
      score: SCORE.probeAgain,
      next: probeOf(profile, s, open),
      stepKind: isPretestOnly(profile, open) ? 'pretest_probe' : 'probe',
      misconception: open,
      ruleReason: reason('probe_again', { m: shortName(open) }),
    },
    practice,
  ];
}

function mainRule(profile: LearnerProfile, attempt: AttemptContext): DraftCandidate[] {
  const { classification } = attempt.outcome;
  switch (classification.type) {
    case 'misconception':
      return misconceptionRule(
        profile,
        attempt,
        classification.id as MisconceptionId,
        classification.variant,
      );
    case 'slip':
      return slipRule(profile, attempt);
    case 'shape_error':
    case 'unknown':
      return unknownRule(profile, attempt);
    case 'correct': {
      const s = attempt.item.ref.skill;
      const open = latestOpen(profile, s);
      return hasPassed(profile, s) && open === null
        ? passedRule(profile, attempt)
        : notYetRule(profile, attempt, open);
    }
  }
}

/** after_attempt (AI_DIRECTOR §2, §3): R7 and R6 join the main rule, then all rank by score. */
export function afterAttemptCandidates(
  profile: LearnerProfile,
  attempt: AttemptContext,
): Candidate[] {
  return finalizeCandidates([
    ...stuckRule(attempt),
    ...reviewRule(profile, attempt),
    ...mainRule(profile, attempt),
  ]);
}

/** session_start (AI_DIRECTOR §2). There is one path, so an LLM only writes the words for it. */
export function sessionStartCandidates(profile: LearnerProfile): Candidate[] {
  const skill = nextSkill(profile);
  if (skill === null) {
    const oldest = longestUnseen(profile) ?? SKILLS[0].id;
    return finalizeCandidates([
      {
        rule: 'start',
        score: SCORE.only,
        next: { skill: oldest, level: REVIEW_LEVEL, purpose: 'review' },
        stepKind: 'review',
        ruleReason: reason('all_passed', { skill: skillName(oldest) }),
      },
    ]);
  }
  const entered = enterSkill(profile, skill);
  const open = entered.misconception;
  return finalizeCandidates([
    {
      rule: 'start',
      score: SCORE.only,
      ...entered,
      stepKind:
        entered.stepKind === 'advance' || entered.stepKind === 'back' ? 'start' : entered.stepKind,
      ruleReason: open
        ? reason('start_probe', { m: shortName(open) })
        : reason('start', { skill: skillName(skill) }),
    },
  ]);
}

/** student_request (AI_DIRECTOR §2). No candidate when no example can be built: nothing plays. */
/**
 * The student tapped a skill on the map. An unlocked one opens as a new skill would, a passed one as
 * practice at its own level. A locked one offers nothing.
 */
export function practiceCandidates(profile: LearnerProfile, skill: SkillId): Candidate[] {
  if (!isUnlocked(profile, skill)) return [];
  if (hasPassed(profile, skill)) {
    return finalizeCandidates([
      {
        rule: 'request',
        score: SCORE.only,
        next: { skill, level: levelOf(profile, skill), purpose: 'review' },
        stepKind: 'chosen',
        ruleReason: reason('chosen', { skill: skillName(skill) }),
      },
    ]);
  }
  const entered = enterSkill(profile, skill);
  return finalizeCandidates([
    {
      rule: 'request',
      score: SCORE.only,
      ...entered,
      stepKind: entered.misconception ? entered.stepKind : 'chosen',
      ruleReason: reason('chosen', { skill: skillName(skill) }),
    },
  ]);
}

export function requestCandidates(item: MatrixItem, nth: number): Candidate[] {
  const scene = chosenScene(helpRequest(item, nth));
  if (!scene) return [];
  return finalizeCandidates([
    {
      rule: 'request',
      score: SCORE.only,
      scene,
      next: { skill: item.ref.skill, level: item.ref.difficulty, purpose: 'resume' },
      stepKind: 'request',
      ruleReason: reason('request'),
    },
  ]);
}
