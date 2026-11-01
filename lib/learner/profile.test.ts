import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { CONFIG } from '@/lib/config';
import { Rational } from '@/lib/core/rational';
import type { Answer, Level } from '@/lib/core/types';
import { generate } from '@/lib/topics/matrix/generators';
import { SKILLS, skillById, type SkillId } from '@/lib/topics/matrix/skills';
import type { MatrixItem, MisconceptionId } from '@/lib/topics/matrix/types';
import {
  advanceHint,
  applyAttempt as applyTimed,
  applyPretest,
  isFixingMisconception,
  levelOf,
  markClipSeen,
  newLearnerProfile,
  noteSceneSeen,
  openMisconceptions,
} from './profile';
import type { AttemptEvent, HintLevel, LearnerProfile, Student } from './types';

const STUDENT: Student = {
  id: 'ABC123-7',
  units: [1, 2, 3, 4, 5],
};

const applyAttempt = (profile: LearnerProfile, event: Omit<AttemptEvent, 'timeMs'>) =>
  applyTimed(profile, { timeMs: 4000, ...event });

const M01: MisconceptionId = 'M01_DIM_SWAP';

function wrongAnswer(item: MatrixItem): Answer {
  switch (item.correct.kind) {
    case 'matrix':
      return {
        kind: 'matrix',
        value: item.correct.value.map((row) => row.map(() => Rational.of(77))),
      };
    case 'scalar':
      return { kind: 'scalar', value: item.correct.value.add(Rational.of(1000)) };
    case 'dims':
      return { kind: 'dims', rows: 97, cols: 98 };
    case 'choice':
      return { kind: 'choice', id: item.correct.id === 'true' ? 'false' : 'true' };
    case 'undefined':
      return item.kind === 'dims_or_undefined'
        ? { kind: 'dims', rows: 97, cols: 98 }
        : { kind: 'matrix', value: [[Rational.of(77)]] };
  }
}

function candidateOf(item: MatrixItem, id: MisconceptionId): Answer {
  const found = item.diagnostics.find((diagnostic) => diagnostic.id === id);
  if (!found || found.answer.kind === 'any_matrix') throw new Error(`no candidate for ${id}`);
  return found.answer;
}

interface PlayOptions {
  skill?: SkillId;
  /** The items the rules would give while a misconception is open. */
  probes?: MisconceptionId;
}

/** One letter per item: ถ right, ผ wrong in no known way, M the misconception in `probes`. */
function play(
  start: LearnerProfile,
  script: string,
  { skill = 'dim', probes = M01 }: PlayOptions = {},
) {
  let profile = start;
  const levels: Level[] = [];
  const known: string[] = [];
  const passed: boolean[] = [];
  [...script].forEach((mark, index) => {
    const difficulty = levelOf(profile, skill);
    const open = profile.misconceptions[probes];
    const target = mark === 'M' || open?.status === 'suspected' || open?.status === 'active';
    const item = generate({
      skill,
      difficulty,
      seed: profile.itemsDone + index * 1000,
      ...(target && { target: probes }),
    });
    const answer =
      mark === 'ถ' ? item.correct : mark === 'M' ? candidateOf(item, probes) : wrongAnswer(item);
    levels.push(difficulty);
    ({ profile } = applyAttempt(profile, { item, answer, hintLevel: 0, at: index * 60_000 }));
    known.push(profile.skills[skill]!.pKnown.toFixed(3));
    passed.push(profile.skills[skill]!.passed);
  });
  return { profile, levels, known, passAt: passed.indexOf(true) + 1 };
}

const fresh = () => newLearnerProfile(STUDENT);
const afterPretest = () => applyPretest(fresh(), { dim: { outcome: 'correct' } }, { at: 0 });

describe('the table of SPEC §7.3, row by row', () => {
  it.each<[string, () => LearnerProfile, string, Level[], string[], number]>([
    ['0.15', fresh, 'ถถถ', [1, 1, 2], ['0.796', '0.988', '0.999'], 3],
    ['0.15', fresh, 'ผถถถ', [1, 1, 1, 2], ['0.166', '0.814', '0.989', '0.999'], 4],
    ['0.15', fresh, 'ถถMถถ', [1, 1, 2, 2, 2], ['0.796', '0.988', '0.913', '0.996', '1.000'], 5],
    [
      '0.15',
      fresh,
      'ถถผผถถ',
      [1, 1, 2, 2, 1, 2],
      ['0.796', '0.988', '0.913', '0.595', '0.969', '0.998'],
      6,
    ],
    ['0.60', afterPretest, 'ถ', [2], ['0.970'], 1],
    ['0.60', afterPretest, 'ผถถถ', [2, 1, 1, 2], ['0.266', '0.887', '0.994', '1.000'], 4],
  ])('from %s: %s', (_, start, script, levels, known, passAt) => {
    const result = play(start(), script);
    expect(result.levels).toEqual(levels);
    expect(result.known).toEqual(known);
    expect(result.passAt).toBe(passAt);
  });
});

describe('counting first attempts (SPEC §7.1)', () => {
  const open = (hintLevel: HintLevel) => {
    const item = generate({ skill: 'dim', difficulty: 1, seed: 1 });
    return applyAttempt(fresh(), { item, answer: item.correct, hintLevel, at: 0 });
  };

  it('a right answer after hint L1 counts as right but not as clean', () => {
    const attempt = open(1).profile.skills.dim!.attempts[0];
    expect(attempt).toEqual({ level: 1, countsCorrect: true, clean: false, timeMs: 4000 });
  });

  it.each<HintLevel>([2, 3])('a right answer after hint L%i counts as wrong', (hintLevel) => {
    const { profile } = open(hintLevel);
    expect(profile.skills.dim!.attempts[0].countsCorrect).toBe(false);
    expect(profile.skills.dim!.pKnown.toFixed(3)).toBe('0.166');
  });

  it('records the real level of the item, not the level of the skill', () => {
    const item = generate({ skill: 'addsub', difficulty: 2, seed: 1, target: 'M05_SUB_REVERSED' });
    const { profile } = applyAttempt(fresh(), { item, answer: item.correct, hintLevel: 0, at: 0 });
    expect(levelOf(profile, 'addsub')).toBe(1);
    expect(profile.skills.addsub!.attempts[0].level).toBe(2);
  });
});

describe('Mastered through applyAttempt (SPEC §7.1)', () => {
  it('passing latches, however far P(L) falls afterwards', () => {
    const passed = play(fresh(), 'ถถถ').profile;
    const after = play(passed, 'ผผผผผผ').profile;
    expect(after.skills.dim!.pKnown).toBeLessThan(CONFIG.mastery.pKnown);
    expect(after.skills.dim!.passed).toBe(true);
  });

  it('an open misconception of this skill holds a pass back', () => {
    const { profile, passAt } = play(fresh(), 'ถถMถ');
    expect(passAt).toBe(0);
    expect(profile.skills.dim!.pKnown).toBeGreaterThan(CONFIG.mastery.pKnown);
    expect(profile.skills.dim!.attempts.filter(({ clean }) => clean)).toHaveLength(3);
    expect(profile.misconceptions[M01]?.status).toBe('suspected');
  });

  it('an open misconception of another skill does not', () => {
    const elsewhere = play(fresh(), 'M', { skill: 'det2', probes: 'M12_DET2_FORMULA' }).profile;
    expect(play(elsewhere, 'ถถถ').passAt).toBe(3);
  });

  it('M11 counts against both of its skills', () => {
    const caught = play(fresh(), 'M', {
      skill: 'mult_noncomm',
      probes: 'M11_MULT_COMMUTATIVE',
    }).profile;
    expect(openMisconceptions(caught, 'mult')).toEqual(['M11_MULT_COMMUTATIVE']);
    expect(openMisconceptions(caught, 'mult_noncomm')).toEqual(['M11_MULT_COMMUTATIVE']);
    expect(openMisconceptions(caught, 'det2')).toEqual([]);
  });
});

describe('misconception status through applyAttempt (SPEC §7.2)', () => {
  it('moves through suspected, active and resolved', () => {
    const one = play(fresh(), 'M').profile;
    expect(one.misconceptions[M01]).toMatchObject({ status: 'suspected', count: 1 });
    const two = play(one, 'M').profile;
    expect(two.misconceptions[M01]).toMatchObject({ status: 'active', count: 2 });
    const done = play(two, 'ถถ').profile;
    expect(done.misconceptions[M01]).toMatchObject({ status: 'resolved', fixStreak: 0 });
  });

  it('a right answer on an item not aimed at it neither helps nor hurts', () => {
    const caught = play(fresh(), 'M').profile;
    const one = applyTarget(caught, true);
    expect(one.misconceptions[M01]?.fixStreak).toBe(1);
    const between = applyPlain(one);
    expect(between.misconceptions[M01]?.fixStreak).toBe(1);
    expect(applyTarget(between, true).misconceptions[M01]?.status).toBe('resolved');
  });

  it('a wrong answer on an item aimed at it breaks the streak', () => {
    const one = applyTarget(play(fresh(), 'M').profile, true);
    const broken = applyTarget(one, false);
    expect(broken.misconceptions[M01]).toMatchObject({ fixStreak: 0, count: 1 });
  });

  it('a right answer with hint L2 on an item aimed at it breaks the streak', () => {
    const one = applyTarget(play(fresh(), 'M').profile, true);
    const helped = applyTarget(one, true, 2);
    expect(helped.misconceptions[M01]).toMatchObject({ status: 'suspected', fixStreak: 0 });
  });

  it('a right answer with hint L1 on an item aimed at it still counts', () => {
    const one = applyTarget(play(fresh(), 'M').profile, true, 1);
    expect(applyTarget(one, true, 1).misconceptions[M01]?.status).toBe('resolved');
  });

  it('remembers the variant caught, for the next probe', () => {
    const item = generate({
      skill: 'inv2',
      difficulty: 2,
      seed: 3,
      target: 'M20_INV2_RECIPE',
      targetVariant: 'NO_DIVIDE',
    });
    const answer = item.diagnostics.find(({ variant }) => variant === 'NO_DIVIDE')!
      .answer as Answer;
    const { profile } = applyAttempt(fresh(), { item, answer, hintLevel: 0, at: 0 });
    expect(profile.misconceptions.M20_INV2_RECIPE?.variant).toBe('NO_DIVIDE');
  });

  it('records items and time to resolve from the clock it is given', () => {
    let profile = play(fresh(), 'M').profile;
    profile = applyTarget(profile, true, 0, 5 * 60_000);
    profile = applyTarget(profile, true, 0, 7 * 60_000);
    expect(profile.misconceptions[M01]).toMatchObject({
      itemsToResolve: 2,
      msToResolve: 7 * 60_000,
    });
  });
});

function applyTarget(
  profile: LearnerProfile,
  right: boolean,
  hintLevel: HintLevel = 0,
  at = 0,
): LearnerProfile {
  const item = generate({
    skill: 'dim',
    difficulty: levelOf(profile, 'dim'),
    seed: 500 + profile.itemsDone,
    target: M01,
  });
  const answer = right ? item.correct : wrongAnswer(item);
  return applyAttempt(profile, { item, answer, hintLevel, at }).profile;
}

function applyPlain(profile: LearnerProfile): LearnerProfile {
  const item = generate({ skill: 'dim', difficulty: 1, seed: 900 + profile.itemsDone });
  return applyAttempt(profile, { item, answer: item.correct, hintLevel: 0, at: 0 }).profile;
}

describe('getting stuck (SPEC §7.5)', () => {
  const wrongs = (start: LearnerProfile, count: number, skill: SkillId = 'dim') => {
    let profile = start;
    let stuckAt = 0;
    for (let index = 0; index < count; index += 1) {
      const item = generate({ skill, difficulty: 1, seed: index });
      const result = applyAttempt(profile, {
        item,
        answer: wrongAnswer(item),
        hintLevel: 0,
        at: 0,
      });
      profile = result.profile;
      if (result.outcome.stuck) stuckAt = index + 1;
    }
    return { profile, stuckAt };
  };

  it('fires on the third wrong first attempt in a row', () => {
    const { profile, stuckAt } = wrongs(fresh(), 3);
    expect(stuckAt).toBe(3);
    expect(profile.skills.dim!.stuck).toBe(true);
  });

  it('counts again from zero after firing, so it needs three more', () => {
    const { profile } = wrongs(fresh(), 5);
    expect(profile.skills.dim!.wrongStreak).toBe(2);
    expect(wrongs(fresh(), 6).stuckAt).toBe(6);
  });

  it('a right answer ends the streak and clears the flag', () => {
    const { profile } = wrongs(fresh(), 3);
    const after = applyPlain(profile);
    expect(after.skills.dim).toMatchObject({ stuck: false, wrongStreak: 0 });
  });

  it('a right answer with hint L2 also ends the streak, while BKT reads it as wrong', () => {
    const { profile } = wrongs(fresh(), 2);
    const item = generate({ skill: 'dim', difficulty: 1, seed: 40 });
    const after = applyAttempt(profile, { item, answer: item.correct, hintLevel: 2, at: 0 });
    expect(after.outcome.stuck).toBe(false);
    expect(after.profile.skills.dim!.wrongStreak).toBe(0);
    expect(after.profile.skills.dim!.attempts.at(-1)?.countsCorrect).toBe(false);
  });

  it('counts each skill apart', () => {
    const one = wrongs(fresh(), 2, 'dim').profile;
    const two = wrongs(one, 2, 'index').profile;
    expect(two.skills.dim!.wrongStreak).toBe(2);
    expect(two.skills.index!.wrongStreak).toBe(2);
  });
});

describe('rewards through applyAttempt (SPEC §11)', () => {
  it('pays XP, grows the combo and keeps the best one', () => {
    const { profile } = play(fresh(), 'ถถผ');
    expect(profile.xp).toBe(2 * CONFIG.xp.firstTry);
    expect(profile.combo).toBe(0);
    expect(profile.bestCombo).toBe(2);
  });

  it('pays +20 once when a misconception is fixed', () => {
    let profile = play(fresh(), 'M').profile;
    const before = profile.xp;
    profile = applyTarget(profile, true);
    const item = generate({ skill: 'dim', difficulty: 1, seed: 77, target: M01 });
    const { outcome, profile: after } = applyAttempt(profile, {
      item,
      answer: item.correct,
      hintLevel: 0,
      at: 0,
    });
    expect(outcome.resolved).toBe(M01);
    expect(outcome.bonusXp).toBe(CONFIG.xp.misconceptionResolved);
    expect(after.xp).toBe(before + 2 * CONFIG.xp.firstTry + CONFIG.xp.misconceptionResolved);
  });

  it('does not pay it again after a relapse', () => {
    const fixed = applyTarget(applyTarget(play(fresh(), 'M').profile, true), true);
    const relapsed = play(fixed, 'M').profile;
    const once = applyTarget(relapsed, true);
    const item = generate({ skill: 'dim', difficulty: 1, seed: 78, target: M01 });
    const { outcome } = applyAttempt(once, { item, answer: item.correct, hintLevel: 0, at: 0 });
    expect(outcome.resolved).toBe(M01);
    expect(outcome.bonusXp).toBe(0);
  });
});

describe('outcomes', () => {
  it('announce a passed skill, a passed unit and the end, once each', () => {
    let profile = newLearnerProfile({ ...STUDENT, units: [3] });
    const announced: { skill: string; unit: unknown; all: boolean }[] = [];
    for (const { id } of SKILLS.filter(({ unit }) => unit === 3)) {
      for (let index = 0; index < 12; index += 1) {
        const difficulty = levelOf(profile, id);
        const item = generate({ skill: id, difficulty, seed: index + 10 });
        const { profile: next, outcome } = applyAttempt(profile, {
          item,
          answer: item.correct,
          hintLevel: 0,
          at: 0,
        });
        profile = next;
        if (outcome.skillPassed) {
          announced.push({
            skill: outcome.skillPassed,
            unit: outcome.unitPassed,
            all: outcome.allPassed,
          });
        }
      }
    }
    expect(announced).toEqual([
      { skill: 'mult_defined', unit: null, all: false },
      { skill: 'mult', unit: null, all: false },
      { skill: 'mult_noncomm', unit: 3, all: true },
    ]);
  });

  it('report which way the level moved', () => {
    const start = play(fresh(), 'ถ').profile;
    const item = generate({ skill: 'dim', difficulty: 1, seed: 5 });
    const up = applyAttempt(start, { item, answer: item.correct, hintLevel: 0, at: 0 });
    expect(up.outcome.levelChange).toBe(1);
    const down = applyAttempt(up.profile, { item, answer: wrongAnswer(item), hintLevel: 0, at: 0 });
    expect(down.outcome.levelChange).toBe(0);
  });

  it('close the item and count it', () => {
    const open: LearnerProfile = {
      ...fresh(),
      current: { ref: generate({ skill: 'dim', difficulty: 1, seed: 1 }).ref, hintLevel: 1 },
    };
    const item = generate({ skill: 'dim', difficulty: 1, seed: 1 });
    const { profile } = applyAttempt(open, { item, answer: item.correct, hintLevel: 1, at: 0 });
    expect(profile.current).toBeUndefined();
    expect(profile.itemsDone).toBe(1);
    expect(profile.skills.dim!.lastSeen).toBe(1);
  });
});

describe('applyPretest (SPEC §7.1, §7.2)', () => {
  it('sets P(L₀) from what the pre-test found', () => {
    const profile = applyPretest(
      fresh(),
      {
        dim: { outcome: 'correct' },
        index: { outcome: 'misconception', caught: [{ id: 'M02_INDEX_SWAP' }] },
        transpose: { outcome: 'other_wrong' },
      },
      { at: 1000 },
    );
    expect(profile.skills.dim?.pKnown).toBe(0.6);
    expect(profile.skills.index?.pKnown).toBe(0.1);
    expect(profile.skills.transpose?.pKnown).toBe(0.25);
    expect(profile.skills.addsub).toBeUndefined();
    expect(fresh().skills.addsub).toBeUndefined();
  });

  it('starts a right skill at L2, and only that', () => {
    const profile = applyPretest(
      fresh(),
      { dim: { outcome: 'correct' }, transpose: { outcome: 'other_wrong' } },
      { at: 0 },
    );
    expect(levelOf(profile, 'dim')).toBe(2);
    expect(levelOf(profile, 'transpose')).toBe(1);
    expect(profile.skills.dim?.pretestCorrect).toBe(true);
    expect(profile.skills.transpose?.pretestCorrect).toBeUndefined();
  });

  it('marks what it caught as suspected', () => {
    const profile = applyPretest(
      fresh(),
      {
        inv2: {
          outcome: 'misconception',
          caught: [{ id: 'M20_INV2_RECIPE', variant: 'NO_SWAP' }],
        },
      },
      { at: 1000 },
    );
    expect(profile.misconceptions.M20_INV2_RECIPE).toMatchObject({
      status: 'suspected',
      count: 1,
      variant: 'NO_SWAP',
      fromPretest: true,
    });
  });

  it('a skill with no item on the form starts as usual', () => {
    expect(levelOf(applyPretest(fresh(), {}, { at: 0 }), 'dim')).toBe(1);
  });
});

describe('isFixingMisconception (R6)', () => {
  it('is true while one caught in the app stays open', () => {
    const caught = play(fresh(), 'M').profile;
    expect(isFixingMisconception(caught)).toBe(true);
    expect(isFixingMisconception(applyTarget(applyTarget(caught, true), true))).toBe(false);
  });

  it('is false for a pre-test flag on a skill not started yet', () => {
    const flagged = applyPretest(
      fresh(),
      { inv2: { outcome: 'misconception', caught: [{ id: 'M21_INV_RECIPROCAL' }] } },
      { at: 0 },
    );
    expect(openMisconceptions(flagged)).toEqual(['M21_INV_RECIPROCAL']);
    expect(isFixingMisconception(flagged)).toBe(false);
    expect(isFixingMisconception(play(flagged, 'ถ').profile)).toBe(false);
    const started = play(flagged, 'ถ', { skill: 'inv2', probes: 'M21_INV_RECIPROCAL' }).profile;
    expect(isFixingMisconception(started)).toBe(true);
  });
});

describe('small helpers', () => {
  it('advanceHint steps once at a time and stops at L3', () => {
    let profile: LearnerProfile = {
      ...fresh(),
      current: { ref: generate({ skill: 'dim', difficulty: 1, seed: 1 }).ref, hintLevel: 0 },
    };
    for (const expected of [1, 2, 3, 3]) {
      profile = advanceHint(profile);
      expect(profile.current?.hintLevel).toBe(expected);
    }
  });

  it('advanceHint does nothing with no open item', () => {
    const profile = fresh();
    expect(advanceHint(profile)).toBe(profile);
  });

  it('markClipSeen adds a skill once', () => {
    const once = markClipSeen(fresh(), 'dim');
    expect(once.clipsSeen).toEqual(['dim']);
    expect(markClipSeen(once, 'dim')).toBe(once);
  });

  it('noteSceneSeen counts views of a misconception', () => {
    const caught = play(fresh(), 'M').profile;
    const seen = noteSceneSeen(noteSceneSeen(caught, M01), M01);
    expect(seen.misconceptions[M01]?.scenesSeen).toBe(2);
  });

  it('noteSceneSeen leaves an unknown misconception alone', () => {
    const profile = fresh();
    expect(noteSceneSeen(profile, M01)).toBe(profile);
  });

  it('never reads the clock', () => {
    const item = generate({ skill: 'dim', difficulty: 1, seed: 1 });
    const event = { item, answer: candidateOf(item, M01), hintLevel: 0 as const, at: 123 };
    const first = JSON.stringify(applyAttempt(fresh(), event));
    expect(JSON.stringify(applyAttempt(fresh(), event))).toBe(first);
    expect(first).toContain('"openedAtMs":123');
  });

  it('survives a trip through JSON', () => {
    const { profile } = play(fresh(), 'ถMผถ');
    expect(JSON.parse(JSON.stringify(profile))).toEqual(profile);
  });
});

describe('any mix of answers', () => {
  it('keeps every number in bounds', () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom('ถ', 'ผ'), { minLength: 1, maxLength: 40 }),
        fc.constantFrom<SkillId>(...SKILLS.map(({ id }) => id)),
        (marks, skill) => {
          let profile = fresh();
          let passedOnce = false;
          for (const [index, mark] of marks.entries()) {
            const before = levelOf(profile, skill);
            const item = generate({ skill, difficulty: before, seed: index });
            const answer = mark === 'ถ' ? item.correct : wrongAnswer(item);
            ({ profile } = applyAttempt(profile, { item, answer, hintLevel: 0, at: index }));
            const state = profile.skills[skill]!;
            expect(state.pKnown).toBeGreaterThan(0);
            expect(state.pKnown).toBeLessThanOrEqual(1);
            expect(Math.abs(state.level - before)).toBeLessThanOrEqual(1);
            expect(state.level).toBeGreaterThanOrEqual(1);
            expect(state.level).toBeLessThanOrEqual(skillById(skill).maxLevel);
            expect(state.wrongStreak).toBeLessThan(CONFIG.stuckAfterWrong);
            if (passedOnce) expect(state.passed).toBe(true);
            passedOnce = state.passed;
          }
        },
      ),
      { numRuns: 1000 },
    );
  });
});
