import { describe, expect, it } from 'vitest';
import { CONFIG, topicsFrom } from '@/lib/config';
import { currentItem } from '@/lib/director/items';
import { startSession } from '@/lib/director/rules';
import { newProfile } from '@/lib/director/turn';
import type { Profile } from '@/lib/director/types';
import { openMisconceptions } from '@/lib/learner/profile';
import { ALL_UNITS, mapOf, nextSkill } from '@/lib/learner/progress';
import { recommendationFor } from '@/lib/learner/recommend';
import type { MisconceptionState, SkillState } from '@/lib/learner/types';
import { applyAction } from '@/lib/sync/actions';
import { generate, regenerate } from './matrix/generators';
import { CATALOG } from './matrix/misconceptions';
import { SKILLS } from './matrix/skills';
import {
  activeTopicOf,
  allMisconceptions,
  allSkills,
  DEFAULT_TOPIC,
  enabledTopics,
  packOf,
  packOfMisconception,
  packOfSkill,
  packOfUnit,
  registeredTopics,
  unitOf,
} from '.';

describe('the topic registry', () => {
  it('has matrices first, then vectors', () => {
    expect(registeredTopics()).toEqual(['matrix', 'vector']);
    expect(DEFAULT_TOPIC).toBe('matrix');
  });

  it('refuses a topic it does not have', () => {
    expect(() => packOf('physics')).toThrow(/unknown topic physics/);
    expect(() => packOfSkill('v_projection')).toThrow(/unknown skill/);
    expect(() => packOfMisconception('V01_SCALAR_VECTOR')).toThrow(/unknown misconception/);
    expect(() => packOfUnit(21)).toThrow(/unknown unit/);
  });

  it('gives the matrix pack the matrix engine itself', () => {
    const pack = packOf('matrix');
    expect(pack.skills).toBe(SKILLS);
    expect(pack.catalog).toBe(CATALOG);
    // Packs are listed in registration order, and matrices come first.
    expect(allSkills().slice(0, SKILLS.length)).toEqual(SKILLS);
    expect(allMisconceptions().slice(0, CATALOG.length)).toEqual(CATALOG);
    expect(pack.units.map(({ id }) => id)).toEqual([...ALL_UNITS]);
    expect(unitOf(3)).toEqual({ id: 3, label: '3', titleTh: 'คูณ' });
  });

  it('keeps the matrix generator version at 2', () => {
    expect(packOf('matrix').generatorVersion).toBe(2);
    expect(CONFIG.generatorVersion).toBe(2);
  });

  it('builds and rebuilds the same items as the matrix generators', () => {
    const pack = packOf('matrix');
    const request = {
      skill: 'mult',
      difficulty: 2,
      seed: 41,
      target: 'M09_MULT_ELEMENTWISE',
    } as const;
    const item = pack.generate(request);
    expect(item).toEqual(generate(request));
    expect(pack.regenerate(item.ref)).toEqual(regenerate(generate(request).ref));
  });
});

describe('the topics switch', () => {
  it('reads a comma list, and means matrices when it is empty', () => {
    expect(topicsFrom(undefined)).toEqual(['matrix']);
    expect(topicsFrom('')).toEqual(['matrix']);
    expect(topicsFrom(' matrix , vector ')).toEqual(['matrix', 'vector']);
  });

  it('offers only topics that are registered and switched on', () => {
    expect(enabledTopics(['matrix'])).toEqual(['matrix']);
    expect(enabledTopics(['matrix', 'vector'])).toEqual(['matrix', 'vector']);
    expect(enabledTopics(['vector'])).toEqual(['vector']);
    expect(enabledTopics(['physics'])).toEqual(['matrix']);
  });

  it('puts a profile from before topics, or one on a topic not offered, on matrices', () => {
    expect(activeTopicOf({})).toBe('matrix');
    expect(activeTopicOf({ activeTopic: 'matrix' })).toBe('matrix');
    expect(activeTopicOf({ activeTopic: 'vector' }, ['matrix'])).toBe('matrix');
    expect(activeTopicOf({ activeTopic: 'vector' }, ['matrix', 'vector'])).toBe('vector');
  });
});

const known: SkillState = {
  pKnown: 0.99,
  level: 2,
  attempts: [{ level: 2, countsCorrect: true, clean: true, timeMs: 1000 }],
  passed: true,
  wrongStreak: 0,
  stuck: false,
  lastSeen: 3,
};

const caught: MisconceptionState = {
  status: 'active',
  count: 2,
  fixStreak: 0,
  scenesSeen: 0,
  openedAtItem: 1,
  openedAtMs: 0,
  lastCaughtAtItem: 2,
  rewarded: false,
};

/** What a profile looks like after a device with vectors switched on has synced. */
function withVectorData(profile: Profile): Profile {
  return {
    ...profile,
    skills: { ...profile.skills, v_points: known, v_linear: { ...known, passed: false } },
    misconceptions: { ...profile.misconceptions, V05_POINTS_REVERSED: caught },
    clipsSeen: [...profile.clipsSeen, 'v_points'],
  };
}

describe('a profile that also holds another topic', () => {
  const plain = newProfile({ id: 'MIX-1', units: [...ALL_UNITS] });
  const mixed = withVectorData(plain);

  it('plans matrices exactly as before', () => {
    expect(nextSkill(mixed)).toBe(nextSkill(plain));
    expect(mapOf(mixed)).toEqual(mapOf(plain));
    expect(recommendationFor(mixed)).toEqual(recommendationFor(plain));
    const matrixOnly = (ids: string[]) =>
      ids.filter((id) => packOfMisconception(id).id === 'matrix');
    expect(matrixOnly(openMisconceptions(mixed))).toEqual(openMisconceptions(plain));
    expect(openMisconceptions(mixed, 'dim')).toEqual([]);
  });

  it('starts the same session on the same item', () => {
    const fromPlain = startSession(plain);
    const fromMixed = startSession(mixed);
    expect(currentItem(fromMixed)).toEqual(currentItem(fromPlain));
    expect(fromMixed.pending).toEqual(fromPlain.pending);
  });
});

describe('choosing a topic', () => {
  const profile = newProfile({ id: 'TOPIC-1', units: [...ALL_UNITS] });

  it('keeps it on the student', () => {
    const { profile: chosen } = applyAction(profile, { type: 'set_topic', topic: 'matrix' });
    expect(chosen.student.activeTopic).toBe('matrix');
    expect(nextSkill(chosen)).toBe(nextSkill(profile));
  });

  it('ignores a topic this engine does not have', () => {
    const physics = { type: 'set_topic', topic: 'physics' } as unknown as Parameters<
      typeof applyAction
    >[1];
    expect(applyAction(profile, physics).profile).toBe(profile);
  });
});
