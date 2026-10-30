import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { CONFIG } from '@/lib/config';
import { deriveSeed } from '@/lib/core/prng';
import { Rational } from '@/lib/core/rational';
import type { Answer, Level } from '@/lib/core/types';
import { regenerate } from '@/lib/topics/matrix/generators';
import { SKILLS, skillById, type SkillId } from '@/lib/topics/matrix/skills';
import type { MatrixItem } from '@/lib/topics/matrix/types';
import { ALL_UNITS, isUnlocked, mapOf, nextSkill, skillStatus } from './path';
import { advanceHint, currentItem, issueItem, levelOf, newProfile, submitAttempt } from './profile';
import type { LocalStudent, Profile, SkillProgress, UnitId } from './types';

function student(units: readonly UnitId[] = ALL_UNITS): LocalStudent {
  return { id: 'ABC123-7', classCode: 'ABC123', seatNo: 7, units: [...units] };
}

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

/** Issues the next item and answers it. `script` has one letter per item: ถ right, ผ wrong. */
function play(
  start: Profile,
  script: string,
): { profile: Profile; levels: Level[]; skills: SkillId[] } {
  let profile = start;
  const levels: Level[] = [];
  const skills: SkillId[] = [];
  for (const mark of script) {
    profile = issueItem(profile);
    const item = currentItem(profile);
    if (!item) throw new Error('no item');
    levels.push(item.ref.difficulty);
    skills.push(item.ref.skill);
    const answer = mark === 'ถ' ? item.correct : wrongAnswer(item);
    profile = submitAttempt(profile, item, answer).profile;
  }
  return { profile, levels, skills };
}

/** Answers the next item correctly after asking for `hints` hints. */
function answerAfterHints(start: Profile, hints: number): Profile {
  let profile = issueItem(start);
  for (let i = 0; i < hints; i += 1) profile = advanceHint(profile);
  const item = currentItem(profile);
  if (!item) throw new Error('no item');
  return submitAttempt(profile, item, item.correct).profile;
}

describe('the stand-in rules against the SPEC §7.3 table', () => {
  const first: SkillId = 'dim';

  it.each<[string, Level[], number]>([
    ['ถถถ', [1, 1, 2], 3],
    ['ผถถถ', [1, 1, 1, 2], 4],
    ['ถถผผถถ', [1, 1, 2, 2, 1, 2], 6],
  ])('%s gives levels %j and passes at item %i', (script, levels, passAt) => {
    const { profile, levels: seen, skills } = play(newProfile(student()), script);
    expect(seen).toEqual(levels);
    expect(skills.every((skill) => skill === first)).toBe(true);
    expect(profile.skills[first]?.passed).toBe(true);
    const short = play(newProfile(student()), script.slice(0, passAt - 1)).profile;
    expect(short.skills[first]?.passed).toBe(false);
  });

  it('passes the M row one item early, since misconception status arrives in Phase 4', () => {
    // SPEC: ถ ถ M ถ ถ passes at item 5 because M must be resolved first.
    const { profile } = play(newProfile(student()), 'ถถผถ');
    expect(profile.skills[first]?.passed).toBe(true);
  });
});

describe('passing a skill', () => {
  it('needs a correct answer at L2 or above, however many at L1', () => {
    // Three clean answers, all of them at L1.
    const { profile, levels } = play(newProfile(student()), 'ถถผผถ');
    expect(levels).toEqual([1, 1, 2, 2, 1]);
    expect(profile.skills.dim?.passed).toBe(false);
  });

  it('does not count an answer helped by a hint', () => {
    let profile = answerAfterHints(newProfile(student()), 1);
    profile = play(profile, 'ถถ').profile;
    expect(profile.skills.dim?.passed).toBe(false);
    profile = play(profile, 'ถ').profile;
    expect(profile.skills.dim?.passed).toBe(true);
  });

  it('counts a correct answer after hint L2 as wrong for the level (SPEC §7.1)', () => {
    const profile = answerAfterHints(play(newProfile(student()), 'ถ').profile, 2);
    expect(levelOf(profile, 'dim')).toBe(1);
  });

  it('lets a correct answer after hint L1 raise the level', () => {
    const profile = answerAfterHints(play(newProfile(student()), 'ถ').profile, 1);
    expect(levelOf(profile, 'dim')).toBe(2);
  });

  it('never lowers the level below L1', () => {
    const { levels } = play(newProfile(student()), 'ผผผผผ');
    expect(levels).toEqual([1, 1, 1, 1, 1]);
  });

  it('never raises the level above maxLevel', () => {
    // Answers helped by hint L1 raise the level without passing the skill. det2 has no L3.
    let profile = newProfile(student([4]));
    for (let i = 0; i < 8; i += 1) {
      profile = answerAfterHints(profile, 1);
      expect(levelOf(profile, 'det2')).toBeLessThanOrEqual(skillById('det2').maxLevel);
    }
    expect(levelOf(profile, 'det2')).toBe(2);
    expect(profile.skills.det2?.passed).toBe(false);
  });
});

describe('rewards through submitAttempt', () => {
  it('adds XP and combo, and remembers the best combo', () => {
    let { profile } = play(newProfile(student()), 'ถถ');
    expect(profile.xp).toBe(20);
    expect(profile.combo).toBe(2);
    profile = play(profile, 'ผ').profile;
    expect(profile.xp).toBe(20);
    expect(profile.combo).toBe(0);
    expect(profile.bestCombo).toBe(2);
  });

  it('holds the combo and pays 3 XP after hint L2', () => {
    const start = play(newProfile(student()), 'ถ').profile;
    const open = advanceHint(advanceHint(issueItem(start)));
    const item = currentItem(open)!;
    const { profile, outcome } = submitAttempt(open, item, item.correct);
    expect(outcome.xp).toBe(CONFIG.xp.withDeepHint);
    expect(profile.combo).toBe(1);
    expect(profile.xp).toBe(CONFIG.xp.firstTry + CONFIG.xp.withDeepHint);
  });

  it('counts the item as done and closes it', () => {
    const profile = issueItem(newProfile(student()));
    const item = currentItem(profile)!;
    const { profile: after, outcome } = submitAttempt(profile, item, item.correct);
    expect(after.itemsDone).toBe(1);
    expect(after.current).toBeUndefined();
    expect(outcome.classification).toEqual({ type: 'correct' });
  });
});

describe('hints', () => {
  it('advance one level at a time and stop at L3', () => {
    let profile = issueItem(newProfile(student()));
    for (const expected of [1, 2, 3, 3]) {
      profile = advanceHint(profile);
      expect(profile.current?.hintLevel).toBe(expected);
    }
  });

  it('reset for the next item', () => {
    const profile = answerAfterHints(newProfile(student()), 1);
    expect(issueItem(profile).current?.hintLevel).toBe(0);
  });

  it('do nothing without an open item', () => {
    const profile = newProfile(student());
    expect(advanceHint(profile)).toBe(profile);
  });
});

describe('misconceptions caught', () => {
  it('are counted by id', () => {
    const start = issueItem(newProfile(student()));
    const item = currentItem(start)!;
    const diagnostic = item.diagnostics[0];
    if (diagnostic.answer.kind === 'any_matrix') throw new Error('dim has a fixed candidate');
    const { profile, outcome } = submitAttempt(start, item, diagnostic.answer);
    expect(outcome.classification).toMatchObject({ type: 'misconception', id: diagnostic.id });
    expect(profile.caught[diagnostic.id]).toBe(1);
  });
});

describe('issueItem', () => {
  it('uses the seed from deriveSeed, so the item can be rebuilt from its ref', () => {
    const profile = issueItem(newProfile(student()));
    expect(profile.current?.ref.seed).toBe(deriveSeed('ABC123-7', 0));
    expect(profile.counter).toBe(1);
    expect(regenerate(profile.current!.ref)).toEqual(currentItem(profile));
  });

  it('gives two students different numbers', () => {
    const a = issueItem(newProfile(student()));
    const b = issueItem(newProfile({ ...student(), id: 'ABC123-8', seatNo: 8 }));
    expect(a.current?.ref.seed).not.toBe(b.current?.ref.seed);
  });

  it('gives a new seed for each item', () => {
    let profile = newProfile(student());
    const seeds = new Set<number>();
    for (let i = 0; i < 20; i += 1) {
      profile = issueItem(profile);
      seeds.add(profile.current!.ref.seed);
      const item = currentItem(profile)!;
      profile = submitAttempt(profile, item, wrongAnswer(item)).profile;
    }
    expect(seeds.size).toBe(20);
  });

  it('leaves an open item alone, so a reload shows the same numbers', () => {
    const profile = issueItem(newProfile(student()));
    expect(issueItem(profile)).toBe(profile);
  });

  it('replaces an item from another generator version instead of throwing', () => {
    const open = issueItem(newProfile(student()));
    const stale: Profile = {
      ...open,
      current: { ref: { ...open.current!.ref, gv: CONFIG.generatorVersion + 1 }, hintLevel: 2 },
    };
    expect(currentItem(stale)).toBeNull();
    const fresh = issueItem(stale);
    expect(fresh.current?.ref.gv).toBe(CONFIG.generatorVersion);
    expect(fresh.current?.hintLevel).toBe(0);
    expect(currentItem(fresh)).not.toBeNull();
  });

  it('clears the item when nothing is left to learn', () => {
    const finished: Profile = {
      ...newProfile(student([3])),
      skills: {
        mult_defined: { level: 2, attempts: [], passed: true },
        mult: { level: 2, attempts: [], passed: true },
        mult_noncomm: { level: 2, attempts: [], passed: true },
      },
    };
    expect(issueItem(finished).current).toBeUndefined();
  });
});

describe('the path', () => {
  it('starts on the first skill of the first open unit', () => {
    expect(nextSkill(newProfile(student()))).toBe('dim');
    expect(nextSkill(newProfile(student([3])))).toBe('mult_defined');
    expect(nextSkill(newProfile(student([4, 5])))).toBe('det2');
  });

  it('walks the skills of Unit 3 in order, then finishes', () => {
    const { skills, profile } = play(newProfile(student([3])), 'ถถถถถถถถถ');
    expect(skills).toEqual([
      'mult_defined',
      'mult_defined',
      'mult_defined',
      'mult',
      'mult',
      'mult',
      'mult_noncomm',
      'mult_noncomm',
      'mult_noncomm',
    ]);
    expect(nextSkill(profile)).toBeNull();
  });

  it('counts a prereq in a closed unit as passed (SPEC §3)', () => {
    const profile = newProfile(student([3]));
    expect(isUnlocked(profile, 'mult_defined')).toBe(true);
    expect(isUnlocked(profile, 'mult')).toBe(false);
  });

  it('locks a skill until its prereqs pass', () => {
    const profile = newProfile(student());
    expect(isUnlocked(profile, 'dim')).toBe(true);
    expect(isUnlocked(profile, 'index')).toBe(false);
    const afterDim = play(profile, 'ถถถ').profile;
    expect(isUnlocked(afterDim, 'index')).toBe(true);
    expect(isUnlocked(afterDim, 'addsub')).toBe(true);
    expect(isUnlocked(afterDim, 'scalar')).toBe(false);
  });

  it('labels each skill for the map', () => {
    const profile = play(newProfile(student()), 'ถถถ').profile;
    expect(skillStatus(profile, 'dim')).toBe('passed');
    expect(skillStatus(profile, 'index')).toBe('current');
    expect(skillStatus(profile, 'addsub')).toBe('open');
    expect(skillStatus(profile, 'scalar')).toBe('locked');
  });

  it('never points at a locked skill, whatever has passed', () => {
    fc.assert(
      fc.property(
        fc.subarray(SKILLS.map(({ id }) => id)),
        fc.subarray([...ALL_UNITS], { minLength: 1 }),
        (passed, units) => {
          const skills: Profile['skills'] = {};
          for (const id of passed) {
            const progress: SkillProgress = { level: 1, attempts: [], passed: true };
            skills[id] = progress;
          }
          const profile: Profile = { ...newProfile(student(units)), skills };
          const next = nextSkill(profile);
          if (next !== null) expect(isUnlocked(profile, next)).toBe(true);
        },
      ),
    );
  });

  it('lists only the open units, in order, and marks finished ones', () => {
    const profile = play(newProfile(student([3, 5])), 'ถถถถถถถถถ').profile;
    const map = mapOf(profile);
    expect(map.map(({ unit }) => unit)).toEqual([3, 5]);
    expect(map[0].passed).toBe(true);
    expect(map[1].passed).toBe(false);
    expect(map[0].skills.map(({ id }) => id)).toEqual(['mult_defined', 'mult', 'mult_noncomm']);
  });
});

describe('outcomes', () => {
  it('announce a passed skill, a passed unit and the end', () => {
    const two = issueItem(play(newProfile(student([3])), 'ถถ').profile);
    const third = currentItem(two)!;
    const passedFirst = submitAttempt(two, third, third.correct);
    expect(passedFirst.outcome).toMatchObject({
      skillPassed: 'mult_defined',
      unitPassed: null,
      allPassed: false,
    });

    const eight = issueItem(play(passedFirst.profile, 'ถถถถถ').profile);
    const ninth = currentItem(eight)!;
    expect(submitAttempt(eight, ninth, ninth.correct).outcome).toMatchObject({
      skillPassed: 'mult_noncomm',
      unitPassed: 3,
      allPassed: true,
    });
  });

  it('announce nothing on an ordinary item', () => {
    const open = issueItem(newProfile(student()));
    const item = currentItem(open)!;
    expect(submitAttempt(open, item, item.correct).outcome).toMatchObject({
      skillPassed: null,
      unitPassed: null,
      allPassed: false,
    });
  });
});

describe('a whole unit', () => {
  it.each<[string, UnitId]>([
    ['Unit 1', 1],
    ['Unit 2', 2],
    ['Unit 3', 3],
    ['Unit 4', 4],
    ['Unit 5', 5],
  ])('a perfect student finishes %s in 3 items per skill', (_, unit) => {
    const skills = SKILLS.filter((skill) => skill.unit === unit);
    const { profile } = play(newProfile(student([unit])), 'ถ'.repeat(skills.length * 3));
    expect(nextSkill(profile)).toBeNull();
    expect(profile.xp).toBe(skills.length * 3 * CONFIG.xp.firstTry);
    expect(profile.bestCombo).toBe(skills.length * 3);
  });

  it('a student who is always wrong stays on the first skill at L1 and does not crash', () => {
    const { profile, levels, skills } = play(newProfile(student([3])), 'ผ'.repeat(200));
    expect(new Set(skills)).toEqual(new Set(['mult_defined']));
    expect(new Set(levels)).toEqual(new Set([1]));
    expect(profile.xp).toBe(0);
  });

  it('any mix of right and wrong keeps the rules in bounds', () => {
    fc.assert(
      fc.property(
        fc.array(fc.boolean(), { minLength: 1, maxLength: 30 }),
        fc.constantFrom<UnitId>(...ALL_UNITS),
        (marks, unit) => {
          let profile = newProfile(student([unit]));
          for (const right of marks) {
            profile = issueItem(profile);
            const item = currentItem(profile);
            if (!item) return; // every skill passed
            expect(isUnlocked(profile, item.ref.skill)).toBe(true);
            expect(item.ref.difficulty).toBeLessThanOrEqual(skillById(item.ref.skill).maxLevel);
            const answer = right ? item.correct : wrongAnswer(item);
            profile = submitAttempt(profile, item, answer).profile;
          }
        },
      ),
    );
  });
});

describe('JSON', () => {
  it('survives a round trip through storage', () => {
    const open = issueItem(play(newProfile(student()), 'ถผถ').profile);
    const restored = JSON.parse(JSON.stringify(open)) as Profile;
    expect(restored).toEqual(open);
    expect(currentItem(restored)).toEqual(currentItem(open));
  });
});
