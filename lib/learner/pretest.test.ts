import { describe, expect, it } from 'vitest';
import { generate } from '@/lib/topics/matrix/generators';
import type { SkillId } from '@/lib/topics/types';
import { applyAttempt, applyPretest, newLearnerProfile } from './profile';
import {
  hasPretestMarks,
  isQuickCheck,
  pretestCheckOf,
  pretestSummaryOf,
  skillStartOf,
} from './pretest';
import { ALL_UNITS } from './progress';
import type { LearnerProfile, PretestResult, Student } from './types';

const STUDENT: Student = { id: 'PRE-TEST-1', units: [...ALL_UNITS] };

/** The results of a real run of form A: 7 of 14, six skills right and four mistakes caught. */
const RESULTS: Partial<Record<SkillId, PretestResult>> = {
  dim: { outcome: 'correct' },
  index: { outcome: 'correct' },
  transpose: { outcome: 'correct' },
  addsub: { outcome: 'misconception', caught: [{ id: 'M05_SUB_REVERSED' }] },
  scalar: { outcome: 'correct' },
  mult_defined: { outcome: 'correct' },
  mult: { outcome: 'misconception', caught: [{ id: 'M09_MULT_ELEMENTWISE' }] },
  mult_noncomm: { outcome: 'misconception', caught: [{ id: 'M11_MULT_COMMUTATIVE' }] },
  det2: { outcome: 'correct' },
  det3: { outcome: 'other_wrong' },
  det_props: { outcome: 'other_wrong' },
  invertible: { outcome: 'misconception', caught: [{ id: 'M19_INV_ZERO_ENTRY' }] },
  inv2: { outcome: 'other_wrong' },
};

const fresh = () => newLearnerProfile(STUDENT);
const tested = () => applyPretest(fresh(), RESULTS, { at: 0 });

/** Answers a dim item right at L2, the way the session would after the pre-test. */
function answerDimRight(profile: LearnerProfile): LearnerProfile {
  const item = generate({ skill: 'dim', difficulty: 2, seed: 11 });
  return applyAttempt(profile, { item, answer: item.correct, hintLevel: 0, timeMs: 4000, at: 1 })
    .profile;
}

describe('what the pre-test changed (SPEC §4, §7.1)', () => {
  it('lists the skills it showed are known, in teaching order', () => {
    const { known } = pretestSummaryOf(tested(), 'matrix');
    expect(known.map(({ skill }) => skill)).toEqual([
      'dim',
      'index',
      'transpose',
      'scalar',
      'mult_defined',
      'det2',
    ]);
    expect(known.every(({ passed }) => !passed)).toBe(true);
  });

  it('lists each mistake it caught under the skill it is about', () => {
    const { caught } = pretestSummaryOf(tested(), 'matrix');
    expect(caught).toEqual([
      { misconception: 'M05_SUB_REVERSED', skill: 'addsub', fixed: false },
      { misconception: 'M09_MULT_ELEMENTWISE', skill: 'mult', fixed: false },
      { misconception: 'M11_MULT_COMMUTATIVE', skill: 'mult_noncomm', fixed: false },
      { misconception: 'M19_INV_ZERO_ENTRY', skill: 'invertible', fixed: false },
    ]);
  });

  it('leaves the rest to be taught as usual', () => {
    const { toLearn } = pretestSummaryOf(tested(), 'matrix');
    expect(toLearn.map(({ skill }) => skill)).toEqual(['det3', 'det_props', 'inv2']);
  });

  it('starts where the director starts: dim, which is a quick check', () => {
    expect(pretestSummaryOf(tested(), 'matrix').start).toEqual({ skill: 'dim', kind: 'quick' });
  });

  it('says a skill with a caught mistake starts with a check of that mistake', () => {
    const profile = applyPretest(
      fresh(),
      { dim: { outcome: 'misconception', caught: [{ id: 'M01_DIM_SWAP' }] } },
      { at: 0 },
    );
    expect(skillStartOf(profile, 'dim')).toEqual({ kind: 'check', misconception: 'M01_DIM_SWAP' });
    expect(pretestCheckOf(profile, 'dim')).toBe('M01_DIM_SWAP');
    expect(pretestSummaryOf(profile, 'matrix').start).toEqual({
      skill: 'dim',
      kind: 'check',
      misconception: 'M01_DIM_SWAP',
    });
  });

  it('marks a known skill as a quick check until it passes', () => {
    const profile = tested();
    expect(isQuickCheck(profile, 'dim')).toBe(true);
    expect(isQuickCheck(profile, 'addsub')).toBe(false);
    const passed = answerDimRight(profile);
    expect(passed.skills.dim?.passed).toBe(true);
    expect(isQuickCheck(passed, 'dim')).toBe(false);
    expect(pretestSummaryOf(passed, 'matrix').known[0]).toEqual({ skill: 'dim', passed: true });
    expect(pretestSummaryOf(passed, 'matrix').start).toEqual({ skill: 'index', kind: 'quick' });
  });

  it('stops calling a mistake waiting once its skill has started', () => {
    const profile = tested();
    expect(pretestCheckOf(profile, 'addsub')).toBe('M05_SUB_REVERSED');
    const addsub = profile.skills.addsub;
    if (!addsub) throw new Error('applyPretest gave addsub no state');
    const started: LearnerProfile = {
      ...profile,
      skills: {
        ...profile.skills,
        addsub: {
          ...addsub,
          attempts: [{ level: 2, countsCorrect: false, clean: false, timeMs: 1 }],
        },
      },
    };
    expect(pretestCheckOf(started, 'addsub')).toBeNull();
  });

  it('shows a fixed mistake as fixed, and keeps it on the list', () => {
    const profile = tested();
    const m05 = profile.misconceptions.M05_SUB_REVERSED;
    if (!m05) throw new Error('applyPretest did not catch M05');
    const fixed: LearnerProfile = {
      ...profile,
      misconceptions: {
        ...profile.misconceptions,
        M05_SUB_REVERSED: { ...m05, status: 'resolved' },
      },
    };
    expect(pretestSummaryOf(fixed, 'matrix').caught[0]).toEqual({
      misconception: 'M05_SUB_REVERSED',
      skill: 'addsub',
      fixed: true,
    });
  });

  it('has nothing to show without a pre-test, or after one with nothing right and nothing caught', () => {
    expect(hasPretestMarks(fresh(), 'matrix')).toBe(false);
    const allWrong = applyPretest(fresh(), { dim: { outcome: 'other_wrong' } }, { at: 0 });
    expect(hasPretestMarks(allWrong, 'matrix')).toBe(false);
    expect(hasPretestMarks(tested(), 'matrix')).toBe(true);
  });

  it('keeps topics apart: the matrix pre-test marks nothing in vectors', () => {
    expect(hasPretestMarks(tested(), 'vector')).toBe(false);
    const { known, caught } = pretestSummaryOf(tested(), 'vector');
    expect(known).toEqual([]);
    expect(caught).toEqual([]);
  });

  it('only counts open units, as the map does', () => {
    const unit3 = applyPretest(newLearnerProfile({ ...STUDENT, units: [3] }), RESULTS, { at: 0 });
    const { known, caught, toLearn, start } = pretestSummaryOf(unit3, 'matrix');
    expect(known.map(({ skill }) => skill)).toEqual(['mult_defined']);
    expect(caught.map(({ misconception }) => misconception)).toEqual([
      'M09_MULT_ELEMENTWISE',
      'M11_MULT_COMMUTATIVE',
    ]);
    expect(toLearn).toEqual([]);
    expect(start).toEqual({ skill: 'mult_defined', kind: 'quick' });
  });
});
