import { describe, expect, it } from 'vitest';
import { deriveSeed } from '@/lib/core/prng';
import { Rational } from '@/lib/core/rational';
import type { Answer } from '@/lib/core/types';
import { sceneDurationMs } from '@/lib/topics/matrix/scenes';
import { SKILLS } from '@/lib/topics/matrix/skills';
import type { MatrixItem } from '@/lib/topics/matrix/types';
import { generate } from '@/lib/topics/matrix/generators';
import { helpScene, leadClip, markClipSeen, remediationFor, workedSceneFor } from './clips';
import { issueItem, newProfile, submitAttempt } from './profile';
import type { LocalStudent, Profile, UnitId } from './types';

const student = (units: UnitId[] = [1, 2, 3, 4, 5]): LocalStudent => ({
  id: 'ABC123-7',
  classCode: 'ABC123',
  seatNo: 7,
  units,
});

function passSkill(profile: Profile, id: (typeof SKILLS)[number]['id']): Profile {
  return {
    ...profile,
    skills: { ...profile.skills, [id]: { level: 2, attempts: [], passed: true } },
  };
}

describe('leadClip (SPEC §4)', () => {
  it('plays before the first item of a new skill, and the first clip of a unit is its intro', () => {
    const clip = leadClip(newProfile(student()));
    expect(clip?.skill).toBe('dim');
    expect(clip?.spec.purpose).toBe('intro');
    expect(sceneDurationMs(clip!.spec)).toBeLessThanOrEqual(40000);
  });

  it('starts at the first open unit', () => {
    const clip = leadClip(newProfile(student([3])));
    expect(clip?.skill).toBe('mult_defined');
    expect(clip?.spec.purpose).toBe('intro');
    expect(clip?.spec.template).toBe('row_col_dot');
  });

  it('later skills in the unit get a concept scene', () => {
    let profile = markClipSeen(newProfile(student()), 'dim');
    profile = passSkill(profile, 'dim');
    const clip = leadClip(profile);
    expect(clip?.skill).toBe('index');
    expect(clip?.spec.purpose).toBe('concept');
    expect(sceneDurationMs(clip!.spec)).toBeLessThanOrEqual(20000);
  });

  it('the next unit opens with its own intro', () => {
    let profile = newProfile(student());
    for (const id of ['dim', 'index', 'transpose'] as const) {
      profile = passSkill(markClipSeen(profile, id), id);
    }
    const clip = leadClip(profile);
    expect(clip?.skill).toBe('addsub');
    expect(clip?.spec.purpose).toBe('intro');
  });

  it('walks every skill: an intro opens each unit and a concept scene the rest, within limits', () => {
    let profile = newProfile(student());
    const seen: [string, string][] = [];
    for (const { id } of SKILLS) {
      const clip = leadClip(profile);
      expect(clip?.skill).toBe(id);
      seen.push([id, clip!.spec.purpose]);
      expect(sceneDurationMs(clip!.spec)).toBeLessThanOrEqual(
        clip!.spec.purpose === 'intro' ? 40000 : 20000,
      );
      profile = passSkill(markClipSeen(profile, id), id);
    }
    expect(leadClip(profile)).toBeNull();
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
    expect(leadClip(markClipSeen(newProfile(student()), 'dim'))).toBeNull();
  });

  it('never interrupts an open item, or a skill already started', () => {
    const open = issueItem(newProfile(student()));
    expect(open.current).toBeDefined();
    expect(leadClip(open)).toBeNull();
    const item = generate({ skill: 'dim', difficulty: 1, seed: 1 });
    const started = submitAttempt(open, item, item.correct).profile;
    expect(started.skills.dim?.attempts).toHaveLength(1);
    expect(leadClip(started)).toBeNull();
  });

  it('has nothing to play once every skill has passed', () => {
    let profile = newProfile(student([1]));
    for (const id of ['dim', 'index', 'transpose'] as const) profile = passSkill(profile, id);
    expect(leadClip(profile)).toBeNull();
  });

  it('reads a profile saved before clips existed', () => {
    const stored = JSON.parse(JSON.stringify(newProfile(student()))) as Profile;
    delete stored.clipsSeen;
    expect(leadClip(stored)?.skill).toBe('dim');
    expect(markClipSeen(stored, 'dim').clipsSeen).toEqual(['dim']);
  });

  it('gives a profile that passed a skill before clips existed the unit intro next', () => {
    const stored = passSkill(newProfile(student()), 'dim');
    delete stored.clipsSeen;
    expect(leadClip(stored)?.spec.purpose).toBe('intro');
  });

  it('gives each student their own concept numbers, the same on every reload', () => {
    const later = (id: string) => {
      const profile = passSkill(markClipSeen(newProfile({ ...student(), id }), 'dim'), 'dim');
      return JSON.stringify(leadClip(profile)?.spec);
    };
    expect(later('ABC123-7')).toBe(later('ABC123-7'));
    expect(later('ABC123-7')).not.toBe(later('ABC123-8'));
  });
});

describe('examples never touch the item counter (SPEC §6)', () => {
  it('watching any number of clips leaves the next item with the same seed', () => {
    const fresh = newProfile(student());
    const withClip = markClipSeen(fresh, 'dim');
    expect(withClip.counter).toBe(fresh.counter);
    const plain = issueItem(fresh);
    const afterClip = issueItem(withClip);
    expect(afterClip.current?.ref).toEqual(plain.current?.ref);
    expect(afterClip.current?.ref.seed).toBe(deriveSeed('ABC123-7', 0));
  });

  it('asking for help keeps the open item, its hint level and the counter', () => {
    const open = issueItem(newProfile(student()));
    const item = generate({ ...open.current!.ref, difficulty: open.current!.ref.difficulty });
    const before = JSON.stringify(open);
    for (let nth = 0; nth < 5; nth += 1) helpScene(item, nth);
    expect(JSON.stringify(open)).toBe(before);
  });
});

describe('helpScene (SPEC §4)', () => {
  const open = generate({ skill: 'mult', difficulty: 1, seed: 4242 });

  it('plays the concept scene as a student request', () => {
    const spec = helpScene(open, 0);
    expect(spec?.purpose).toBe('request');
    expect(spec?.template).toBe('row_col_dot');
    expect(sceneDurationMs(spec!)).toBeLessThanOrEqual(20000);
  });

  it('shows new numbers on each press', () => {
    expect(JSON.stringify(helpScene(open, 0))).not.toBe(JSON.stringify(helpScene(open, 1)));
  });

  it('never plays the item being worked on', () => {
    for (let seed = 0; seed < 300; seed += 1) {
      const item = generate({ skill: 'mult', difficulty: 1, seed });
      const spec = helpScene(item, 0);
      if (spec?.template !== 'row_col_dot' || item.data.form !== 'mult') throw new Error('wrong');
      expect(JSON.stringify([spec.params.left, spec.params.right])).not.toBe(
        JSON.stringify([item.data.A, item.data.B]),
      );
    }
  });
});

function answerFor(item: MatrixItem): Answer {
  return item.diagnostics[0].answer as Answer;
}

describe('remediationFor', () => {
  it('plays a clip for a caught misconception with a template of its own', () => {
    const item = generate({
      skill: 'mult',
      difficulty: 1,
      seed: 8,
      target: 'M09_MULT_ELEMENTWISE',
    });
    const answer = answerFor(item);
    const result = remediationFor(item, answer, {
      type: 'misconception',
      id: 'M09_MULT_ELEMENTWISE',
    });
    expect(result?.isClip).toBe(true);
    expect(result?.spec.purpose).toBe('remediate');
    expect(result?.spec.template).toBe('row_col_dot');
  });

  it('offers a worked_solution scene through the button, not as a clip', () => {
    const item = generate({ skill: 'addsub', difficulty: 2, seed: 8, target: 'M05_SUB_REVERSED' });
    const answer = answerFor(item);
    const caught = { type: 'misconception', id: 'M05_SUB_REVERSED' } as const;
    expect(remediationFor(item, answer, caught)?.isClip).toBe(false);
    expect(workedSceneFor(item, answer, caught).purpose).toBe('remediate');
  });

  it('has nothing for any other wrong answer, whose worked solution is a plain reveal', () => {
    const item = generate({ skill: 'mult', difficulty: 1, seed: 8 });
    const answer: Answer = { kind: 'matrix', value: [[Rational.of(77)]] };
    expect(remediationFor(item, answer, { type: 'unknown' })).toBeNull();
    expect(remediationFor(item, item.correct, { type: 'correct' })).toBeNull();
    expect(workedSceneFor(item, answer, { type: 'unknown' }).purpose).toBe('reveal');
  });
});
