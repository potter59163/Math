import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { CONFIG } from '@/lib/config';
import { th } from '@/lib/content/th';
import { storeAnswer } from '@/lib/core/answerJson';
import { fillTokens } from '@/lib/core/tokens';
import type { Answer, Item } from '@/lib/core/types';
import { applyPretest } from '@/lib/learner/profile';
import type { LearnerProfile, PretestResult, ThemeId } from '@/lib/learner/types';
import { misconceptionAnswer, slipAnswer, unknownAnswer } from '@/lib/sim/answers';
import { startingProfile } from '@/lib/server/account';
import { applyAction, attemptEvent, type LearnerAction } from '@/lib/sync/actions';
import { activeTopicOf, packOf, skillOf, type SkillId, type TopicId } from '@/lib/topics';
import { generate as generateVector } from '@/lib/topics/vector/generators';
import { finalizeCandidates, sessionStartCandidates, type AttemptContext } from './candidates';
import { fixedCandidates, fixedStepAt, itemsDoneIn } from './fixedPath';
import { currentItem } from './items';
import { beginSession, openInOtherTopic, prepareAttempt, startSession } from './rules';
import { chosenScene, leadClip } from './scene';
import { commitTurn, dropOtherTopics, newProfile } from './turn';
import type { Candidate, Condition, NextStep, Profile } from './types';

// A session start now lets go of what is open in another topic, and the fixed path counts the items
// of its own topic. Matrices must behave exactly as before for every profile with matrix items
// only, which is every profile so far. Below are beginSession, fixedCandidates and withTopic as
// they were before (dceb45e), and a property that walks such profiles through every action a
// student can send and compares the old and the new code at each step.

function fixedCandidatesBefore(profile: LearnerProfile, attempt?: AttemptContext): Candidate[] {
  const pack = packOf(activeTopicOf(profile.student));
  const { skill, level } = fixedStepAt(pack.openUnits(profile.student), profile.itemsDone, pack.id);
  const next: NextStep = { skill, level, purpose: 'practice' };
  const wrong = attempt && attempt.outcome.classification.type !== 'correct';
  const solution = wrong ? chosenScene({ kind: 'reveal', ref: attempt.item.ref }) : undefined;
  const clip = profile.clipsSeen.includes(skill) ? undefined : leadClip(profile, next);
  const [scene, thenScene] = [solution, clip].filter((one) => one !== undefined);
  return finalizeCandidates([
    {
      rule: 'fixed',
      score: 1,
      ...(scene && { scene }),
      ...(thenScene && { thenScene }),
      next,
      stepKind: 'fixed',
      ruleReason: fillTokens(th.ruleReasons.fixed, {
        skill: skillOf(skill).nameTh,
        level: String(level),
      }),
    },
  ]);
}

function beginSessionBefore(profile: Profile, condition: Condition) {
  if (profile.pending || currentItem(profile)) return { profile, turn: null };
  const candidates =
    condition === 'fixed' ? fixedCandidatesBefore(profile) : sessionStartCandidates(profile);
  return commitTurn(profile, {
    trigger: 'session_start',
    mode: condition === 'fixed' ? 'fixed' : 'rules',
    candidates,
    choice: candidates[0].id,
  });
}

function withTopicBefore(profile: Profile, topic: TopicId): Profile {
  const { current, pending, ...rest } = profile;
  const pendingTopic = pending && (pending.closed?.ref.topic ?? pending.turn.next?.topic);
  return {
    ...rest,
    student: { ...profile.student, activeTopic: topic },
    ...(current && current.ref.topic === topic && { current }),
    ...(pending && (pendingTopic === undefined || pendingTopic === topic) && { pending }),
  };
}

const MATRIX = packOf('matrix');
const SKILL_IDS = MATRIX.skills.map(({ id }) => id);
const UNIT_IDS = MATRIX.units.map(({ id }) => id);
const THEMES: ThemeId[] = ['shop', 'game', 'sport', 'music', 'food'];
const CONDITIONS: Condition[] = ['adaptive', 'fixed'];
const TOPICS: TopicId[] = ['matrix', 'vector'];
const AT = 1_800_000_000_000;

type Move =
  | { type: 'answer'; roll: number; which: number }
  | { type: 'help'; nth: number }
  | { type: 'practice'; skill: SkillId }
  | { type: 'pretest'; results: [SkillId, number][] }
  | { type: 'start' }
  | { type: 'hint' }
  | { type: 'finish_scene' }
  | { type: 'finish_turn' };

/**
 * Right `rate` percent of the time. Otherwise a slip, an answer the catalog does not know, or one
 * of the misconceptions the item can show.
 */
function answerOf(
  item: Item,
  rate: number,
  { roll, which }: { roll: number; which: number },
): Answer {
  if (roll < rate) return item.correct;
  if (roll % 3 === 0) return slipAnswer(item);
  if (roll % 3 === 1 || item.diagnostics.length === 0) return unknownAnswer(item);
  const { id, variant } = item.diagnostics[which % item.diagnostics.length];
  return misconceptionAnswer(item, id, variant) ?? slipAnswer(item);
}

function pretestOf(results: [SkillId, number][]): Partial<Record<SkillId, PretestResult>> {
  return Object.fromEntries(
    results.map(([skill, how]): [SkillId, PretestResult] => {
      const shown = MATRIX.catalog.find(({ skills }) => skills.includes(skill));
      if (how === 0) return [skill, { outcome: 'correct' }];
      if (how === 1 && shown)
        return [skill, { outcome: 'misconception', caught: [{ id: shown.id }] }];
      return [skill, { outcome: 'other_wrong' }];
    }),
  );
}

/** What a device would send for this move. With nothing open, an answer is a session start. */
function actionOf(
  profile: Profile,
  move: Exclude<Move, { type: 'pretest' }>,
  { at, rate }: { at: number; rate: number },
): LearnerAction {
  if (move.type !== 'answer' && move.type !== 'help') return move;
  const item = currentItem(profile);
  if (!item) return { type: 'start' };
  if (move.type === 'help') return { type: 'help', ref: item.ref, nth: move.nth };
  return {
    type: 'attempt',
    ref: item.ref,
    answer: storeAnswer(answerOf(item, rate, move)),
    hintLevel: profile.current?.hintLevel ?? 0,
    timeMs: 40_000,
    at,
  };
}

const startArb = fc
  .record({
    id: fc.string({ minLength: 1, maxLength: 12 }),
    units: fc.subarray(UNIT_IDS, { minLength: 1 }),
    theme: fc.option(fc.constantFrom(...THEMES), { nil: undefined }),
    activeTopic: fc.option(fc.constant<TopicId>('matrix'), { nil: undefined }),
  })
  .map(({ id, units, theme, activeTopic }) =>
    newProfile({ id, units, ...(theme && { theme }), ...(activeTopic && { activeTopic }) }),
  );

const moveArb: fc.Arbitrary<Move> = fc.oneof(
  {
    weight: 8,
    arbitrary: fc.record({ type: fc.constant('answer'), roll: fc.nat(99), which: fc.nat(7) }),
  },
  {
    weight: 5,
    arbitrary: fc.constantFrom({ type: 'finish_scene' as const }, { type: 'finish_turn' as const }),
  },
  { weight: 2, arbitrary: fc.constantFrom({ type: 'start' as const }, { type: 'hint' as const }) },
  { weight: 1, arbitrary: fc.record({ type: fc.constant('help'), nth: fc.nat(3) }) },
  {
    weight: 1,
    arbitrary: fc.record({ type: fc.constant('practice'), skill: fc.constantFrom(...SKILL_IDS) }),
  },
  {
    weight: 1,
    arbitrary: fc.record({
      type: fc.constant('pretest'),
      results: fc.uniqueArray(fc.tuple(fc.constantFrom(...SKILL_IDS), fc.nat(2)), {
        selector: ([skill]) => skill,
        maxLength: 5,
      }),
    }),
  },
);

/**
 * `offered` came later: the items a decision could have opened, kept so the server pays XP only for
 * those (lib/server/sync.ts). No student sees it, and it goes with the open item it was offered with.
 */
function withoutOffered(profile: Profile): Profile {
  const copy = { ...profile };
  delete copy.offered;
  return copy;
}

/** Everything the change touches, old against new, on one profile with matrix items only. */
function expectAsBefore(profile: Profile): void {
  // What the fixed path now counts by: on matrix items only, every item done is a matrix answer.
  expect(itemsDoneIn(profile, 'matrix')).toBe(profile.itemsDone);
  expect(openInOtherTopic(profile)).toBe(false);
  expect(fixedCandidates(profile)).toEqual(fixedCandidatesBefore(profile));
  for (const condition of CONDITIONS) {
    const before = beginSessionBefore(profile, condition);
    const now = beginSession(profile, condition);
    expect(now).toEqual(before);
    // With something open, a reload hands back the very same profile.
    if (before.turn === null) expect(now.profile).toBe(profile);
  }
  for (const topic of TOPICS) {
    const { profile: switched } = applyAction(profile, { type: 'set_topic', topic });
    expect(withoutOffered(switched)).toEqual(withoutOffered(withTopicBefore(profile, topic)));
    if (!switched.current) expect(switched.offered).toBeUndefined();
  }
}

describe(`a profile with matrix items only, with topics ${CONFIG.topics.join(',')}`, () => {
  it('gets the same session start, fixed path and topic switch as before', () => {
    fc.assert(
      fc.property(
        startArb,
        fc.array(moveArb, { minLength: 1, maxLength: 60, size: 'max' }),
        fc.constantFrom(...CONDITIONS),
        // How often this student is right, in percent.
        fc.constantFrom(50, 85, 100),
        (start, moves, condition, rate) => {
          let profile = start;
          for (const [index, move] of moves.entries()) {
            expectAsBefore(profile);
            const at = AT + index * 60_000;
            if (move.type === 'pretest') {
              // The server takes a pre-test only from a student with no item done (testBlock).
              if (profile.itemsDone === 0)
                profile = applyPretest(profile, pretestOf(move.results), { at });
              continue;
            }
            const action = actionOf(profile, move, { at, rate });
            const event = action.type === 'attempt' ? attemptEvent(action) : null;
            if (event) {
              // The fixed path after an answer, whichever group this student is in.
              const { after, attempt, candidates } = prepareAttempt(profile, event, 'fixed');
              expect(candidates).toEqual(fixedCandidatesBefore(after, attempt));
            }
            profile = applyAction(profile, action, condition).profile;
          }
          expectAsBefore(profile);
          // A guest's progress carried over at sign-in keeps its items and answers as they were.
          const carried = startingProfile('account-1', 'shop', JSON.parse(JSON.stringify(profile)));
          expect(carried.itemsDone).toBe(profile.itemsDone);
          expect(itemsDoneIn(carried, 'matrix')).toBe(carried.itemsDone);
        },
      ),
      { numRuns: 1000 },
    );
  });
});

describe('itemsDoneIn', () => {
  it('counts the answers in one topic, and none of another topic', () => {
    const item = generateVector({ skill: 'v_quantity', difficulty: 1, seed: 1 });
    let profile = newProfile({ id: 'ABC123-7', units: [1, 2, 3, 4, 5] });
    for (const answer of [item.correct, unknownAnswer(item)]) {
      ({ profile } = applyAction(profile, {
        type: 'attempt',
        ref: item.ref,
        answer: storeAnswer(answer),
        hintLevel: 0,
        timeMs: 1,
        at: AT,
      }));
    }
    expect(profile.itemsDone).toBe(2);
    expect(itemsDoneIn(profile, 'vector')).toBe(2);
    expect(itemsDoneIn(profile, 'matrix')).toBe(0);
  });
});

describe('openInOtherTopic and dropOtherTopics', () => {
  const vectorItem = generateVector({ skill: 'v_quantity', difficulty: 1, seed: 1 });
  const onMatrices = (): Profile => newProfile({ id: 'ABC123-7', units: [1, 2, 3, 4, 5] });

  it('sees a vector item left open while the student learns matrices', () => {
    const leftOpen: Profile = { ...onMatrices(), current: { ref: vectorItem.ref, hintLevel: 0 } };
    expect(openInOtherTopic(leftOpen)).toBe(true);
    expect(dropOtherTopics(leftOpen, 'matrix').current).toBeUndefined();
    expect(dropOtherTopics(leftOpen, 'vector')).toBe(leftOpen);
  });

  it('judges a decision by the item it closed, then by the one it leads to', () => {
    const answered = applyAction(
      { ...onMatrices(), current: { ref: vectorItem.ref, hintLevel: 0 } },
      {
        type: 'attempt',
        ref: vectorItem.ref,
        answer: storeAnswer(unknownAnswer(vectorItem)),
        hintLevel: 0,
        timeMs: 1,
        at: AT,
      },
    ).profile;
    expect(answered.pending?.closed?.ref.topic).toBe('vector');
    expect(dropOtherTopics(answered, 'vector')).toBe(answered);
    const dropped = dropOtherTopics(answered, 'matrix');
    expect(dropped.pending).toBeUndefined();
    expect(dropped.current).toBeUndefined();
    // Only the next step is let go: the answer is in the model.
    expect(dropped.skills).toBe(answered.skills);
    expect(dropped.itemsDone).toBe(1);

    // A vector answer that leads to a matrix item goes with its answer, and the matrix item stays.
    const { ref } = currentItem(startSession(onMatrices()))!;
    const turn = { ...answered.pending!.turn, next: ref };
    const mixed: Profile = {
      ...answered,
      current: { ref, hintLevel: 0 },
      pending: { ...answered.pending!, turn },
    };
    expect(dropOtherTopics(mixed, 'matrix')).toEqual({ ...mixed, pending: undefined });
    // With its answer gone, as after the first of two clips, the item it leads to decides.
    const onlyTurn: Profile = { ...mixed, pending: { turn } };
    expect(dropOtherTopics(onlyTurn, 'matrix')).toBe(onlyTurn);
    expect(dropOtherTopics(onlyTurn, 'vector')).toEqual({
      ...onlyTurn,
      current: undefined,
      offered: undefined,
      pending: undefined,
    });
  });
});
