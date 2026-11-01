import { describe, expect, it } from 'vitest';
import { CONFIG } from '@/lib/config';
import type { Answer, Level } from '@/lib/core/types';
import { applyAttempt, applyPretest } from '@/lib/learner/profile';
import type { SkillState, UnitId } from '@/lib/learner/types';
import { misconceptionAnswer, slipAnswer, unknownAnswer } from '@/lib/sim/answers';
import { generate } from '@/lib/topics/matrix/generators';
import { SKILLS, type SkillId } from '@/lib/topics/matrix/skills';
import type { MatrixItem, MisconceptionId } from '@/lib/topics/matrix/types';
import { afterAttemptCandidates, requestCandidates, sessionStartCandidates } from './candidates';
import { newProfile } from './turn';
import type { Candidate, Profile } from './types';

const M09: MisconceptionId = 'M09_MULT_ELEMENTWISE';

const passedState = (lastSeen: number): SkillState => ({
  pKnown: 0.99,
  level: 2,
  attempts: [],
  passed: true,
  wrongStreak: 0,
  stuck: false,
  lastSeen,
});

const NOW = 20;

/** A student on this skill, with everything before it passed just now, so no review is due. */
function on(skill: SkillId, units: UnitId[], state: Partial<SkillState> = {}): Profile {
  const base = newProfile({ id: 'ABC123-7', units });
  const skills: Profile['skills'] = {};
  const open = SKILLS.filter(({ unit }) => units.includes(unit)).map(({ id }) => id);
  for (const id of open.slice(0, open.indexOf(skill))) skills[id] = passedState(NOW);
  skills[skill] = { ...passedState(NOW), passed: false, pKnown: 0.3, level: 1, ...state };
  return {
    ...base,
    itemsDone: NOW,
    lastReviewAt: NOW,
    skills,
    clipsSeen: open.slice(0, open.indexOf(skill) + 1),
  };
}

function after(profile: Profile, item: MatrixItem, answer: Answer) {
  const { profile: next, outcome } = applyAttempt(profile, {
    item,
    answer,
    hintLevel: 0,
    at: 0,
    timeMs: 1000,
  });
  return {
    profile: next,
    outcome,
    candidates: afterAttemptCandidates(next, { item, answer, outcome }),
  };
}

const brief = ({ id, rule, score, scene, next }: Candidate) => [
  id,
  rule,
  score,
  scene?.template ?? null,
  next,
];

const multItem = (difficulty: Level = 1, target?: MisconceptionId, seed = 8) =>
  generate({ skill: 'mult', difficulty, seed, ...(target && { target }) });

describe('R1: last answer was a misconception', () => {
  const item = multItem(1, M09);
  const answer = misconceptionAnswer(item, M09)!;
  const probe = { skill: 'mult', level: 1, purpose: 'probe', target: M09 };

  it('offers the compare scene, the bare probe and the worked solution, as in §3', () => {
    const { candidates } = after(on('mult', [3]), item, answer);
    expect(candidates.map(brief)).toEqual([
      ['c1', 'R1', 0.9, 'row_col_dot', probe],
      ['c2', 'R1', 0.7, null, probe],
      ['c3', 'R1', 0.6, 'worked_solution', probe],
    ]);
    expect(candidates[0].scene?.beats).toContain('compare');
    expect(candidates[0].stepKind).toBe('remediate');
    expect(candidates[1].stepKind).toBe('probe');
    expect(candidates[2].stepKind).toBe('worked');
  });

  it('after two views of its scene, testing comes first at .92', () => {
    const seen: Profile = {
      ...on('mult', [3]),
      misconceptions: {
        [M09]: {
          status: 'suspected',
          count: 1,
          fixStreak: 0,
          scenesSeen: 2,
          openedAtItem: 1,
          openedAtMs: 0,
          lastCaughtAtItem: 1,
          rewarded: false,
        },
      },
    };
    const { candidates } = after(seen, item, answer);
    expect(candidates[0]).toMatchObject({ score: 0.92, stepKind: 'probe' });
    expect(candidates[0].scene).toBeUndefined();
    expect(candidates[1]).toMatchObject({ score: 0.9, stepKind: 'remediate' });
  });

  it('asks probeLevel for the level, since some levels cannot show it', () => {
    const sub = generate({ skill: 'addsub', difficulty: 2, seed: 3, target: 'M05_SUB_REVERSED' });
    const { candidates } = after(
      on('addsub', [2]),
      sub,
      misconceptionAnswer(sub, 'M05_SUB_REVERSED')!,
    );
    for (const candidate of candidates) expect(candidate.next.level).toBe(2);
  });

  it('offers its own clip, the probe alone and the worked solution, all for M05 at that level', () => {
    const sub = generate({ skill: 'addsub', difficulty: 2, seed: 3, target: 'M05_SUB_REVERSED' });
    const { candidates } = after(
      on('addsub', [2]),
      sub,
      misconceptionAnswer(sub, 'M05_SUB_REVERSED')!,
    );
    expect(candidates.map(brief).map(([, , score, template]) => [score, template])).toEqual([
      [0.9, 'cell_by_cell'],
      [0.7, null],
      [0.6, 'worked_solution'],
    ]);
  });

  it('passes the variant it caught, so det = ±1 cannot hide a missing division', () => {
    const inv = generate({
      skill: 'inv2',
      difficulty: 2,
      seed: 5,
      target: 'M20_INV2_RECIPE',
      targetVariant: 'NO_DIVIDE',
    });
    const caught = misconceptionAnswer(inv, 'M20_INV2_RECIPE', 'NO_DIVIDE')!;
    const { candidates } = after(on('inv2', [5]), inv, caught);
    for (const candidate of candidates) {
      expect(candidate.next).toMatchObject({ targetVariant: 'NO_DIVIDE' });
      expect(candidate.next.level).toBeGreaterThanOrEqual(2);
    }
  });

  it('plays the choice scene of M11 on a choice item', () => {
    const choice = generate({
      skill: 'mult_noncomm',
      difficulty: 1,
      seed: 4,
      target: 'M11_MULT_COMMUTATIVE',
    });
    const { candidates } = after(
      on('mult_noncomm', [3]),
      choice,
      misconceptionAnswer(choice, 'M11_MULT_COMMUTATIVE')!,
    );
    expect(candidates[0].scene?.template).toBe('grid_transform');
  });

  it('lowers the worked option only for that item, never the skill', () => {
    const atTwo = multItem(2, M09);
    const { profile, candidates } = after(
      on('mult', [3], { level: 2, attempts: [right(1), right(1), right(1)] }),
      atTwo,
      misconceptionAnswer(atTwo, M09)!,
    );
    expect(candidates[2].next.level).toBe(1);
    expect(profile.skills.mult?.level).toBe(2);
  });
});

function right(level: Level) {
  return { level, countsCorrect: true, clean: true, timeMs: 1 };
}

describe('R2: last answer was a slip', () => {
  it('offers the same level, then the same level with hint L1', () => {
    const item = multItem();
    const { candidates } = after(on('mult', [3]), item, slipAnswer(item));
    const same = { skill: 'mult', level: 1, purpose: 'practice' };
    expect(candidates.map(brief)).toEqual([
      ['c1', 'R2', 0.8, null, same],
      ['c2', 'R2', 0.5, null, { ...same, hintLevel: 1 }],
    ]);
    expect(candidates[0].stepKind).toBe('same_level');
  });

  it('says so when the level fell', () => {
    const item = multItem(2);
    const { candidates, profile } = after(
      on('mult', [3], { level: 2, attempts: [right(1)] }),
      item,
      slipAnswer(item),
    );
    expect(profile.skills.mult?.level).toBe(1);
    expect(candidates[0]).toMatchObject({ stepKind: 'level_down', next: { level: 1 } });
  });
});

describe('R3: wrong for no known reason', () => {
  const item = multItem(2);
  const state = { level: 2 as const, attempts: [right(1), right(1), right(1)] };

  it('offers the worked solution with an easier item, then the concept scene', () => {
    const { candidates, profile } = after(on('mult', [3], state), item, unknownAnswer(item));
    expect(candidates.map(brief)).toEqual([
      ['c1', 'R3', 0.8, 'worked_solution', { skill: 'mult', level: 1, purpose: 'practice' }],
      ['c2', 'R3', 0.6, 'row_col_dot', { skill: 'mult', level: 2, purpose: 'practice' }],
    ]);
    expect(candidates[0].stepKind).toBe('worked');
    expect(candidates[1].stepKind).toBe('concept');
    // The easier item is for this once (MISCONCEPTIONS §4.1).
    expect(profile.skills.mult?.level).toBe(2);
  });

  it('treats a shape error the same way', () => {
    const answer: Answer = { kind: 'undefined' };
    const undefinedable = generate({ skill: 'addsub', difficulty: 2, seed: 2 });
    const { outcome, candidates } = after(on('addsub', [2]), undefinedable, answer);
    if (outcome.classification.type === 'correct') return;
    expect(candidates[0].rule).toBe('R3');
  });
});

describe('R4: this skill has passed', () => {
  /** Two clean answers done, so one more at L2 passes it. */
  const nearPass: Partial<SkillState> = {
    pKnown: 0.988,
    level: 2,
    attempts: [right(1), right(1)],
  };

  it('advances to the next skill with its lead clip, and offers a challenge', () => {
    const item = multItem(2);
    const before = {
      ...on('mult', [3], nearPass),
      clipsSeen: ['mult_defined', 'mult'] as SkillId[],
    };
    const { candidates, outcome } = after(before, item, item.correct);
    expect(outcome.skillPassed).toBe('mult');
    expect(candidates.map(brief)).toEqual([
      ['c1', 'R4', 0.9, 'grid_transform', { skill: 'mult_noncomm', level: 1, purpose: 'practice' }],
      ['c2', 'R4', 0.5, null, { skill: 'mult', level: 3, purpose: 'challenge' }],
    ]);
    expect(candidates[0].stepKind).toBe('advance');
    expect(candidates[0].scene?.request.kind).toBe('concept');
  });

  it('opens a new unit with its intro', () => {
    const item = generate({ skill: 'mult_noncomm', difficulty: 2, seed: 4 });
    const { candidates } = after(on('mult_noncomm', [3, 4], nearPass), item, item.correct);
    expect(candidates[0].next.skill).toBe('det2');
    expect(candidates[0].scene?.request.kind).toBe('intro');
  });

  it('offers no challenge on a skill with no L3, which leaves one path (det2)', () => {
    const item = generate({ skill: 'det2', difficulty: 2, seed: 4 });
    const { candidates } = after(on('det2', [4], nearPass), item, item.correct);
    expect(candidates.map(({ rule }) => rule)).toEqual(['R4']);
    expect(candidates[0].next.skill).toBe('det3');
  });

  it('with no skill left, offers a review of the one unseen the longest', () => {
    const item = generate({ skill: 'mult_noncomm', difficulty: 2, seed: 4 });
    const before = on('mult_noncomm', [3], nearPass);
    before.skills.mult_defined = passedState(3);
    const { candidates, outcome } = after(before, item, item.correct);
    expect(outcome.allPassed).toBe(true);
    expect(candidates[0]).toMatchObject({
      rule: 'R4',
      score: 0.9,
      stepKind: 'review',
      next: { skill: 'mult_defined', level: 2, purpose: 'review' },
    });
    expect(candidates[1]).toMatchObject({ score: 0.5, next: { purpose: 'challenge', level: 3 } });
  });

  it('after a right review, goes back to the skill in progress and says so', () => {
    const before = on('mult', [3], { attempts: [right(1)] });
    const review = generate({ skill: 'mult_defined', difficulty: 2, seed: 9 });
    const { candidates } = after(before, review, review.correct);
    expect(candidates[0]).toMatchObject({ rule: 'R4', stepKind: 'back', next: { skill: 'mult' } });
    expect(candidates[0].scene).toBeUndefined();
  });

  it('never goes to a skill whose prereqs are not done', () => {
    const item = generate({ skill: 'dim', difficulty: 2, seed: 1 });
    const { candidates } = after(on('dim', [1, 2, 3, 4, 5], nearPass), item, item.correct);
    expect(candidates[0].next.skill).toBe('index');
  });

  it('counts a prereq in a closed unit as passed', () => {
    const item = generate({ skill: 'invertible', difficulty: 2, seed: 1 });
    const { candidates } = after(
      on('invertible', [5], { ...nearPass, pKnown: 0.99 }),
      item,
      item.correct,
    );
    expect(candidates[0].next.skill).toBe('inv2');
  });
});

describe('R5: right, but not done with this skill', () => {
  it('practises at the level, a single path', () => {
    const item = multItem();
    const { candidates } = after(on('mult', [3]), item, item.correct);
    expect(candidates.map(brief)).toEqual([
      ['c1', 'R5', 0.8, null, { skill: 'mult', level: 1, purpose: 'practice' }],
    ]);
  });

  it('says so when the level rose', () => {
    const item = multItem();
    const { candidates, outcome } = after(
      on('mult', [3], { attempts: [right(1)] }),
      item,
      item.correct,
    );
    expect(outcome.levelChange).toBe(1);
    expect(candidates[0]).toMatchObject({ stepKind: 'level_up', next: { level: 2 } });
  });

  it('with an open misconception, probes it first', () => {
    const probe = multItem(1, M09);
    const caught = after(on('mult', [3]), probe, misconceptionAnswer(probe, M09)!).profile;
    const next = multItem(1, M09, 11);
    const { candidates } = after(caught, next, next.correct);
    expect(candidates.map(brief)).toEqual([
      ['c1', 'R5', 0.85, null, { skill: 'mult', level: 1, purpose: 'probe', target: M09 }],
      ['c2', 'R5', 0.8, null, { skill: 'mult', level: 1, purpose: 'practice' }],
    ]);
    expect(candidates[0]).toMatchObject({ stepKind: 'probe', misconception: M09 });
  });

  it('applies on a passed skill too: a misconception found on review is fixed before moving on', () => {
    const review = generate({
      skill: 'mult_defined',
      difficulty: 2,
      seed: 9,
      target: 'M08_MULT_DIM_RULE',
    });
    const caught = after(
      on('mult', [3], { attempts: [right(1)] }),
      review,
      misconceptionAnswer(review, 'M08_MULT_DIM_RULE')!,
    );
    expect(caught.candidates[0].next).toMatchObject({ skill: 'mult_defined', purpose: 'probe' });
    const next = generate({
      skill: 'mult_defined',
      difficulty: 2,
      seed: 10,
      target: 'M08_MULT_DIM_RULE',
    });
    const { candidates } = after(caught.profile, next, next.correct);
    expect(candidates[0]).toMatchObject({
      rule: 'R5',
      next: { skill: 'mult_defined', purpose: 'probe', target: 'M08_MULT_DIM_RULE' },
    });
  });
});

describe('R6: time for a review', () => {
  const dueProfile = (): Profile => {
    const profile = on('mult', [3], { attempts: [right(1)] });
    profile.skills.mult_defined = passedState(3);
    profile.lastReviewAt = 0;
    return profile;
  };

  it('joins the main rule and wins at .95', () => {
    const item = multItem();
    const { candidates } = after(dueProfile(), item, item.correct);
    expect(candidates[0]).toMatchObject({
      rule: 'R6',
      score: 0.95,
      stepKind: 'review',
      next: { skill: 'mult_defined', level: 2, purpose: 'review' },
    });
    expect(candidates[1].rule).toBe('R5');
  });

  it('needs the last answer to be right', () => {
    const item = multItem();
    const { candidates } = after(dueProfile(), item, slipAnswer(item));
    expect(candidates.some(({ rule }) => rule === 'R6')).toBe(false);
  });

  it('waits while any misconception is being fixed', () => {
    const probe = multItem(1, M09);
    const caught = after(dueProfile(), probe, misconceptionAnswer(probe, M09)!).profile;
    const next = multItem(1, M09, 11);
    const { candidates } = after(caught, next, next.correct);
    expect(candidates.some(({ rule }) => rule === 'R6')).toBe(false);
  });

  it('does not wait for a pre-test flag on a skill not started yet', () => {
    const flagged = applyPretest(
      dueProfile(),
      { det2: { outcome: 'misconception', caught: [{ id: 'M12_DET2_FORMULA' }] } },
      { at: 0 },
    );
    const item = multItem();
    const { candidates } = after(flagged, item, item.correct);
    expect(candidates[0].rule).toBe('R6');
  });

  it('merges with the review of R4 when everything has passed', () => {
    const item = generate({ skill: 'mult_noncomm', difficulty: 2, seed: 4 });
    const before = on('mult_noncomm', [3], {
      pKnown: 0.988,
      level: 2,
      attempts: [right(1), right(1)],
    });
    before.skills.mult_defined = passedState(3);
    before.lastReviewAt = 0;
    const { candidates } = after(before, item, item.correct);
    const reviews = candidates.filter(({ next }) => next.purpose === 'review');
    expect(reviews).toHaveLength(1);
    expect(reviews[0]).toMatchObject({ rule: 'R6', score: 0.95 });
  });
});

describe('R7: stuck', () => {
  const third = { wrongStreak: 2, attempts: [] };

  it('joins the main rule and wins at .97, with an L1 item', () => {
    const item = multItem(1, M09);
    const { candidates, outcome } = after(
      on('mult', [3], third),
      item,
      misconceptionAnswer(item, M09)!,
    );
    expect(outcome.stuck).toBe(true);
    expect(candidates.map(({ rule, score }) => [rule, score])).toEqual([
      ['R7', 0.97],
      ['R1', 0.9],
      ['R1', 0.7],
      ['R1', 0.6],
    ]);
    expect(candidates[0]).toMatchObject({
      stepKind: 'worked',
      next: { skill: 'mult', level: 1, purpose: 'practice' },
    });
    expect(candidates[0].next.target).toBeUndefined();
    expect(candidates[0].scene?.template).toBe('worked_solution');
  });

  it('merges with the same option of R3, which leaves two', () => {
    const item = multItem();
    const { candidates } = after(on('mult', [3], third), item, unknownAnswer(item));
    expect(candidates.map(({ rule, score }) => [rule, score])).toEqual([
      ['R7', 0.97],
      ['R3', 0.6],
    ]);
  });

  it('sits above a slip, at most three options', () => {
    const item = multItem();
    const { candidates } = after(on('mult', [3], third), item, slipAnswer(item));
    expect(candidates.map(({ rule }) => rule)).toEqual(['R7', 'R2', 'R2']);
  });
});

describe('every decision', () => {
  it('has unique candidates, 1 to 4, ranked, with ids in order', () => {
    const cases: [Profile, MatrixItem, Answer][] = [
      [on('mult', [3]), multItem(1, M09), misconceptionAnswer(multItem(1, M09), M09)!],
      [on('mult', [3], { wrongStreak: 2 }), multItem(), unknownAnswer(multItem())],
      [on('mult', [3]), multItem(), slipAnswer(multItem())],
      [on('mult', [3]), multItem(), multItem().correct],
    ];
    for (const [profile, item, answer] of cases) {
      const { candidates } = after(profile, item, answer);
      expect(candidates.length).toBeGreaterThanOrEqual(1);
      expect(candidates.length).toBeLessThanOrEqual(CONFIG.llm.maxCandidates);
      candidates.forEach(({ id }, index) => expect(id).toBe(`c${index + 1}`));
      const scores = candidates.map(({ score }) => score);
      expect(scores).toEqual([...scores].sort((a, b) => b - a));
      expect(candidates.every(({ ruleReason }) => ruleReason.length > 0)).toBe(true);
    }
  });

  it('has the fields AI_DIRECTOR §4.1 sends to the LLM', () => {
    const item = multItem(1, M09);
    const { candidates } = after(on('mult', [3]), item, misconceptionAnswer(item, M09)!);
    expect(candidates[0]).toMatchObject({
      id: 'c1',
      scene: { template: 'row_col_dot', beats: expect.arrayContaining(['compare', 'pick_row']) },
      next: { skill: 'mult', level: 1, purpose: 'probe', target: M09 },
      ruleReason: expect.stringContaining('คูณทีละช่อง'),
    });
  });

  it('stays plain JSON', () => {
    const item = multItem(1, M09);
    const { candidates } = after(on('mult', [3]), item, misconceptionAnswer(item, M09)!);
    expect(JSON.parse(JSON.stringify(candidates))).toEqual(candidates);
  });

  it('spends no seed: candidates leave the counter alone', () => {
    const item = multItem();
    const before = on('mult', [3]);
    const { profile } = after(before, item, unknownAnswer(item));
    expect(profile.counter).toBe(before.counter);
  });
});

describe('session_start (AI_DIRECTOR §2)', () => {
  const fresh = (units: UnitId[] = [1, 2, 3, 4, 5]) =>
    newProfile({ id: 'ABC123-7', units });

  it('starts at the first skill with its unit intro, as a single path', () => {
    const candidates = sessionStartCandidates(fresh());
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      rule: 'start',
      stepKind: 'start',
      next: { skill: 'dim', level: 1, purpose: 'practice' },
      scene: { request: { kind: 'intro', unit: 1 } },
    });
  });

  it('starts at the first open unit', () => {
    expect(sessionStartCandidates(fresh([3]))[0].next.skill).toBe('mult_defined');
  });

  it('starts at L2, with no clip, on a skill right on the pre-test', () => {
    const profile = applyPretest(fresh(), { dim: { outcome: 'correct' } }, { at: 0 });
    const [only] = sessionStartCandidates(profile);
    expect(only).toMatchObject({ stepKind: 'skip_clip', next: { skill: 'dim', level: 2 } });
    expect(only.scene).toBeUndefined();
  });

  it('starts with a probe on a misconception the pre-test found, and still plays the clip', () => {
    const profile = applyPretest(
      fresh(),
      { dim: { outcome: 'misconception', caught: [{ id: 'M01_DIM_SWAP' }] } },
      { at: 0 },
    );
    const [only] = sessionStartCandidates(profile);
    expect(only).toMatchObject({
      stepKind: 'pretest_probe',
      misconception: 'M01_DIM_SWAP',
      next: { purpose: 'probe', target: 'M01_DIM_SWAP' },
      scene: { request: { kind: 'intro' } },
    });
  });

  it('says "start" on a skill already begun, not that a review just ended', () => {
    const begun = on('mult', [3], { attempts: [right(1)] });
    expect(sessionStartCandidates(begun)[0]).toMatchObject({
      stepKind: 'start',
      next: { skill: 'mult' },
    });
  });

  it('with every skill passed, starts on a review', () => {
    const profile: Profile = {
      ...fresh([3]),
      skills: {
        mult_defined: passedState(5),
        mult: passedState(2),
        mult_noncomm: passedState(9),
      },
    };
    expect(sessionStartCandidates(profile)[0]).toMatchObject({
      stepKind: 'review',
      next: { skill: 'mult', level: 2, purpose: 'review' },
    });
  });
});

describe('student_request (AI_DIRECTOR §2)', () => {
  const open = generate({ skill: 'mult', difficulty: 1, seed: 4242 });

  it('offers one path: the concept scene, then back to the item', () => {
    const candidates = requestCandidates(open, 0);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      rule: 'request',
      stepKind: 'request',
      next: { skill: 'mult', purpose: 'resume' },
      scene: { template: 'row_col_dot', request: { kind: 'concept', purpose: 'request' } },
    });
  });

  it('uses a new example on each press', () => {
    const seed = (nth: number) => {
      const { request } = requestCandidates(open, nth)[0].scene!;
      return request.kind === 'concept' ? request.seed : null;
    };
    expect(seed(0)).not.toBe(seed(1));
  });
});
