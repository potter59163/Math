import { describe, expect, it } from 'vitest';
import { Rational } from '@/lib/core/rational';
import type { Answer } from '@/lib/core/types';
import { markClipSeen } from '@/lib/learner/profile';
import type { Student, SkillState, UnitId } from '@/lib/learner/types';
import { misconceptionAnswer } from '@/lib/sim/answers';
import { generate } from '@/lib/topics/matrix/generators';
import { det2, shape } from '@/lib/topics/matrix/ops';
import { sceneDurationMs, sceneLimitMs, type SceneSpec } from '@/lib/topics/matrix/scenes';
import { SKILLS, type SkillId } from '@/lib/topics/matrix/skills';
import type { MatrixItem } from '@/lib/topics/matrix/types';
import { drawItem } from './items';
import { buildScene, helpRequest, leadClip, needsLeadClip, workedRequest } from './scene';
import { newProfile } from './turn';
import type { NextStep, Profile } from './types';

const student = (units: UnitId[] = [1, 2, 3, 4, 5]): Student => ({
  id: 'ABC123-7',
  units,
});

const passedState: SkillState = {
  pKnown: 0.99,
  level: 2,
  attempts: [],
  passed: true,
  wrongStreak: 0,
  stuck: false,
  lastSeen: 0,
};

function passSkill(profile: Profile, id: SkillId): Profile {
  return { ...markClipSeen(profile, id), skills: { ...profile.skills, [id]: passedState } };
}

const firstItem = (skill: SkillId): NextStep => ({ skill, level: 1, purpose: 'practice' });

const specOf = (profile: Profile, skill: SkillId): SceneSpec =>
  buildScene(leadClip(profile, firstItem(skill))!.request);

describe('leadClip (SPEC §4)', () => {
  it('walks every skill: an intro opens each unit and a concept scene the rest, within limits', () => {
    let profile = newProfile(student());
    const seen: [string, string][] = [];
    for (const { id } of SKILLS) {
      expect(needsLeadClip(profile, id)).toBe(true);
      const spec = specOf(profile, id);
      seen.push([id, spec.purpose]);
      expect(sceneDurationMs(spec)).toBeLessThanOrEqual(sceneLimitMs(spec.purpose));
      profile = passSkill(profile, id);
    }
    expect(seen).toEqual([
      ['dim', 'intro'],
      ['index', 'concept'],
      ['transpose', 'concept'],
      ['addsub', 'intro'],
      ['scalar', 'concept'],
      ['mult_defined', 'intro'],
      ['mult', 'concept'],
      ['mult_noncomm', 'concept'],
      ['det2', 'intro'],
      ['det3', 'concept'],
      ['det_props', 'concept'],
      ['invertible', 'intro'],
      ['inv2', 'concept'],
    ]);
  });

  it('plays once: not again after it was seen or skipped', () => {
    expect(needsLeadClip(markClipSeen(newProfile(student()), 'dim'), 'dim')).toBe(false);
  });

  it('does not interrupt a skill already started', () => {
    const started: Profile = {
      ...newProfile(student()),
      skills: { dim: { ...passedState, passed: false, attempts: [] } },
    };
    expect(needsLeadClip(started, 'dim')).toBe(true);
    started.skills.dim!.attempts = [{ level: 1, countsCorrect: true, clean: true, timeMs: 1 }];
    expect(needsLeadClip(started, 'dim')).toBe(false);
  });

  it('skips a skill right on the pre-test', () => {
    const profile: Profile = {
      ...newProfile(student()),
      skills: { dim: { ...passedState, passed: false, pretestCorrect: true } },
    };
    expect(needsLeadClip(profile, 'dim')).toBe(false);
  });

  it('gives each student their own concept numbers, the same on every reload', () => {
    const later = (id: string) => {
      const profile = passSkill(newProfile({ ...student(), id }), 'dim');
      return JSON.stringify(specOf(profile, 'index'));
    };
    expect(later('ABC123-7')).toBe(later('ABC123-7'));
    expect(later('ABC123-7')).not.toBe(later('ABC123-8'));
  });
});

describe('a concept clip is never the item that follows it (SPEC §4)', () => {
  const STUDENTS = Array.from({ length: 1500 }, (_, index) => `ABC123-${index}`);

  /** True when the clip draws the same numbers the next item asks about. */
  function sameNumbers(spec: SceneSpec, next: MatrixItem): boolean {
    const { data } = next;
    const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
    switch (spec.template) {
      case 'cell_locator':
        return (
          data.form === 'index' &&
          same([spec.params.A, spec.params.i, spec.params.j], [data.A, data.i, data.j])
        );
      case 'transpose_flip':
        return data.form === 'transpose' && same(spec.params.A, data.A);
      case 'sarrus':
        return (data.form === 'det2' || data.form === 'det3') && same(spec.params.A, data.A);
      case 'row_col_dot':
        return (
          data.form === 'mult' && same([spec.params.left, spec.params.right], [data.A, data.B])
        );
      case 'inverse_recipe':
        return data.form === 'inv2' && same(spec.params.A, data.A);
      case 'cell_by_cell':
        return data.form === 'scalar'
          ? same(spec.params.left, data.A) && spec.params.k?.equals(Rational.of(data.k)) === true
          : data.form === 'addsub' && same([spec.params.left, spec.params.right], [data.A, data.B]);
      case 'det_sum':
        return data.form === 'det_sum' && same([spec.params.A, spec.params.B], [data.A, data.B]);
      case 'worked_solution':
        return false;
      case 'grid_transform': {
        if (data.form === 'det_scaled') {
          const [before, after] = spec.params.shown.map(({ value }) => value);
          const k = after[1][1].div(before[1][1]);
          return det2(before).equals(Rational.of(data.d)) && k.equals(Rational.of(data.k));
        }
        if (data.form === 'invertible') return same(spec.params.shown[0].value, data.A);
        return false;
      }
      case 'dimension_match':
        return data.form === 'addsub'
          ? same(spec.params.first, shape(data.A)) && same(spec.params.second, shape(data.B))
          : false;
    }
  }

  it.each([
    'index',
    'transpose',
    'scalar',
    'mult',
    'mult_noncomm',
    'det3',
    'det_props',
    'inv2',
  ] as const)('%s plays something other than the next item, for every student', (skill) => {
    const position = SKILLS.findIndex(({ id }) => id === skill);
    for (const id of STUDENTS) {
      let profile = newProfile({ ...student(), id });
      for (const earlier of SKILLS.slice(0, position)) profile = passSkill(profile, earlier.id);
      const step = firstItem(skill);
      const spec = buildScene(leadClip(profile, step)!.request);
      expect(spec.purpose).toBe('concept');
      const next = drawItem(profile, step).item;
      expect(next.ref.skill).toBe(skill);
      // addsub compares only dims, and the same dims are fine, so it is not in this list.
      expect(sameNumbers(spec, next)).toBe(false);
    }
  });

  it('looks ahead without opening anything', () => {
    const profile = passSkill(newProfile(student()), 'dim');
    const before = JSON.stringify(profile);
    leadClip(profile, firstItem('index'));
    expect(JSON.stringify(profile)).toBe(before);
    expect(profile.counter).toBe(0);
  });
});

describe('helpRequest (SPEC §4)', () => {
  const open = generate({ skill: 'mult', difficulty: 1, seed: 4242 });

  it('plays the concept scene as a student request', () => {
    const spec = buildScene(helpRequest(open, 0));
    expect(spec.purpose).toBe('request');
    expect(spec.template).toBe('row_col_dot');
    expect(sceneDurationMs(spec)).toBeLessThanOrEqual(sceneLimitMs('request'));
  });

  it('shows new numbers on each press', () => {
    const scene = (nth: number) => JSON.stringify(buildScene(helpRequest(open, nth)));
    expect(scene(0)).not.toBe(scene(1));
  });

  it('never plays the item being worked on', () => {
    for (let seed = 0; seed < 300; seed += 1) {
      const item = generate({ skill: 'mult', difficulty: 1, seed });
      const spec = buildScene(helpRequest(item, 0));
      if (spec.template !== 'row_col_dot' || item.data.form !== 'mult') throw new Error('wrong');
      expect(JSON.stringify([spec.params.left, spec.params.right])).not.toBe(
        JSON.stringify([item.data.A, item.data.B]),
      );
    }
  });
});

describe('workedRequest: what "ดูวิธีทำ" opens', () => {
  it('opens the plain solution for a misconception with a clip of its own', () => {
    const item = generate({ skill: 'addsub', difficulty: 2, seed: 8, target: 'M05_SUB_REVERSED' });
    const answer = misconceptionAnswer(item, 'M05_SUB_REVERSED')!;
    const request = workedRequest(item, answer, {
      type: 'misconception',
      id: 'M05_SUB_REVERSED',
    });
    expect(request.kind).toBe('reveal');
    expect(buildScene(request).purpose).toBe('reveal');
  });

  it('opens the plain solution for a misconception with a clip of its own', () => {
    const item = generate({
      skill: 'mult',
      difficulty: 1,
      seed: 8,
      target: 'M09_MULT_ELEMENTWISE',
    });
    const answer = misconceptionAnswer(item, 'M09_MULT_ELEMENTWISE')!;
    expect(
      workedRequest(item, answer, { type: 'misconception', id: 'M09_MULT_ELEMENTWISE' }).kind,
    ).toBe('reveal');
  });

  it('opens the plain solution for any other wrong answer', () => {
    const item = generate({ skill: 'mult', difficulty: 1, seed: 8 });
    const answer: Answer = { kind: 'matrix', value: [[Rational.of(77)]] };
    const request = workedRequest(item, answer, { type: 'unknown' });
    expect(request).toEqual({ kind: 'reveal', ref: item.ref });
    expect(buildScene(request).purpose).toBe('reveal');
  });
});
