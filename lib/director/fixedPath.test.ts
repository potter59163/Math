import { describe, expect, it } from 'vitest';
import { deriveSeed } from '@/lib/core/prng';
import type { LocalStudent, UnitId } from '@/lib/learner/types';
import { misconceptionAnswer, unknownAnswer } from '@/lib/sim/answers';
import { answerItem, openItem, settle } from '@/lib/sim/drive';
import { SKILLS } from '@/lib/topics/matrix/skills';
import { fixedCandidates, fixedStepAt } from './fixedPath';
import { startSession } from './rules';
import { newProfile } from './turn';
import type { ChosenScene, Profile } from './types';

const student = (units: UnitId[]): LocalStudent => ({
  id: 'ABC123-7',
  classCode: 'ABC123',
  seatNo: 7,
  units,
});

describe('fixedStepAt (AI_DIRECTOR §3.1)', () => {
  it('walks each skill through levels 1, 1, 2, 2, 3', () => {
    const steps = Array.from({ length: 10 }, (_, position) => fixedStepAt([3], position));
    expect(steps.map(({ level }) => level)).toEqual([1, 1, 2, 2, 3, 1, 1, 2, 2, 3]);
    expect(steps.slice(0, 5).every(({ skill }) => skill === 'mult_defined')).toBe(true);
    expect(steps.slice(5).every(({ skill }) => skill === 'mult')).toBe(true);
  });

  it('uses L2 for a skill with no L3', () => {
    const levels = [0, 1, 2, 3, 4].map((position) => fixedStepAt([4], position).level);
    expect(fixedStepAt([4], 0).skill).toBe('det2');
    expect(levels).toEqual([1, 1, 2, 2, 2]);
  });

  it('goes through every open skill in teaching order', () => {
    const open = SKILLS.filter(({ unit }) => unit >= 3).map(({ id }) => id);
    const order = open.map((_, index) => fixedStepAt([3, 4, 5], index * 5).skill);
    expect(order).toEqual(open);
  });

  it('starts over from the first skill after the last one', () => {
    const lap = SKILLS.filter(({ unit }) => unit >= 3).length * 5;
    expect(fixedStepAt([3, 4, 5], lap)).toEqual(fixedStepAt([3, 4, 5], 0));
  });
});

describe('a student on the fixed path', () => {
  const clips: ChosenScene[] = [];
  const walk = (start: Profile, count: number, wrong = false) => {
    let profile = start;
    const seen: { skill: string; level: number; target?: string; seed: number }[] = [];
    for (let index = 0; index < count; index += 1) {
      const opened = openItem(profile, 'fixed', (scene) => clips.push(scene));
      const { ref } = opened.item;
      seen.push({ skill: ref.skill, level: ref.difficulty, target: ref.target, seed: ref.seed });
      const answer = wrong ? unknownAnswer(opened.item) : opened.item.correct;
      ({ profile } = answerItem(opened.profile, opened.item, answer, { condition: 'fixed' }));
    }
    return { profile, seen };
  };

  it('gets the same skills and levels whether right or wrong', () => {
    const right = walk(newProfile(student([3])), 15);
    const wrong = walk(newProfile(student([3])), 15, true);
    const route = (steps: typeof right.seen) => steps.map(({ skill, level }) => [skill, level]);
    expect(route(wrong.seen)).toEqual(route(right.seen));
    expect(right.seen.map(({ level }) => level)).toEqual([
      1, 1, 2, 2, 3, 1, 1, 2, 2, 3, 1, 1, 2, 2, 3,
    ]);
  });

  it('never gets a probe, even when caught', () => {
    let profile = newProfile(student([3]));
    for (let index = 0; index < 12; index += 1) {
      const opened = openItem(profile, 'fixed');
      expect(opened.item.ref.target).toBeUndefined();
      const caught = misconceptionAnswer(opened.item, 'M08_MULT_DIM_RULE');
      const answer = caught ?? opened.item.correct;
      ({ profile } = answerItem(opened.profile, opened.item, answer, { condition: 'fixed' }));
    }
    expect(profile.misconceptions.M08_MULT_DIM_RULE?.count).toBeGreaterThan(0);
  });

  it('after the last skill, starts over on new numbers', () => {
    const { seen } = walk(newProfile(student([3])), 16);
    expect(seen[15].skill).toBe('mult_defined');
    expect(seen[15].level).toBe(1);
    expect(seen[15].seed).not.toBe(seen[0].seed);
    expect(new Set(seen.map(({ seed }) => seed)).size).toBe(16);
    expect(seen[15].seed).toBe(deriveSeed('ABC123-7', 15));
  });

  it('plays each lead clip once, even on the second lap', () => {
    clips.length = 0;
    walk(newProfile(student([3])), 31);
    const lead = clips.filter(
      ({ request }) => request.kind === 'intro' || request.kind === 'concept',
    );
    expect(lead).toHaveLength(3);
  });

  it('does not skip the clip for a skill right on the pre-test', () => {
    const profile = newProfile(student([3]));
    const flagged: Profile = {
      ...profile,
      skills: {
        mult_defined: {
          pKnown: 0.6,
          level: 2,
          attempts: [],
          passed: false,
          wrongStreak: 0,
          stuck: false,
          lastSeen: 0,
          pretestCorrect: true,
        },
      },
    };
    const [only] = fixedCandidates(flagged);
    expect(only.scene?.request.kind).toBe('intro');
    expect(only.next.level).toBe(1);
  });

  it('shows the worked solution after a wrong answer, and nothing after a right one', () => {
    const start = settle(startSession(newProfile(student([3])), 'fixed'));
    const opened = openItem(start, 'fixed');
    const wrong = answerItem(opened.profile, opened.item, unknownAnswer(opened.item), {
      condition: 'fixed',
    });
    expect(wrong.turn.scenes.map(({ template }) => template)).toEqual(['worked_solution']);
    const right = answerItem(opened.profile, opened.item, opened.item.correct, {
      condition: 'fixed',
    });
    expect(right.turn.scenes).toEqual([]);
  });

  it('plays the solution and then the next lead clip when both are due', () => {
    let profile = newProfile(student([3]));
    for (let index = 0; index < 4; index += 1) {
      const opened = openItem(profile, 'fixed');
      ({ profile } = answerItem(opened.profile, opened.item, opened.item.correct, {
        condition: 'fixed',
      }));
    }
    const opened = openItem(profile, 'fixed');
    const { turn } = answerItem(opened.profile, opened.item, unknownAnswer(opened.item), {
      condition: 'fixed',
    });
    expect(turn.scenes.map(({ request }) => request.kind)).toEqual(['reveal', 'concept']);
  });

  it('shows no reason on the path', () => {
    const opened = openItem(newProfile(student([3])), 'fixed');
    const { turn } = answerItem(opened.profile, opened.item, opened.item.correct, {
      condition: 'fixed',
    });
    expect(turn.mode).toBe('fixed');
    expect(turn.pathStep.note).toBe('');
  });
});
