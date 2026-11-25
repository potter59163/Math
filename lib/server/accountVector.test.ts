import { describe, expect, it, vi } from 'vitest';

// Vectors are switched on for this file only, as NEXT_PUBLIC_TOPICS=matrix,vector does on the server.
vi.hoisted(() => {
  process.env.NEXT_PUBLIC_TOPICS = 'matrix,vector';
});

import { CONFIG } from '@/lib/config';
import { newProfile } from '@/lib/director/turn';
import type { Profile } from '@/lib/director/types';
import { ALL_UNITS } from '@/lib/learner/progress';
import { answerItem, openItem } from '@/lib/sim/drive';
import { planned, type SimStudent } from '@/lib/sim/students';
import { applyAction } from '@/lib/sync/actions';
import { activeTopicOf, packOfSkill } from '@/lib/topics';
import { startingProfile } from './account';

// A guest who chose vectors on the topic tab signs in, and the welcome request carries their profile.

const AT = 1_800_000_000_000;

function practised(profile: Profile, student: SimStudent, items: number): Profile {
  let next = profile;
  for (let index = 0; index < items; index += 1) {
    const opened = openItem(next);
    ({ profile: next } = answerItem(opened.profile, opened.item, student.answer(opened.item), {
      at: AT + index * 60_000,
    }));
  }
  return next;
}

/** Some matrices, then the vector tab and some vectors, all on this device as a guest. */
function vectorGuest(): Profile {
  const guest = newProfile({ id: 'guest-3f2a', units: [...ALL_UNITS], theme: 'shop' });
  const matrices = practised(guest, planned(0.7, 1), 12);
  const chosen = applyAction(matrices, { type: 'set_topic', topic: 'vector' }).profile;
  return practised(chosen, planned(0.7, 2), 8);
}

const asSent = (profile: Profile): Profile => JSON.parse(JSON.stringify(profile)) as Profile;

const topicsOf = (profile: Profile) =>
  new Set(Object.keys(profile.skills).map((skill) => packOfSkill(skill).id));

describe('a guest learning vectors who signs in', () => {
  it('has vectors switched on here', () => {
    expect(CONFIG.topics).toEqual(['matrix', 'vector']);
    const guest = vectorGuest();
    expect(guest.student.activeTopic).toBe('vector');
    expect(topicsOf(guest)).toEqual(new Set(['matrix', 'vector']));
  });

  it('stays on vectors, with what they earned in both topics', () => {
    const guest = vectorGuest();
    const profile = startingProfile('user-1', 'game', asSent(guest));
    expect(profile.student).toEqual({
      id: 'user-1',
      units: [1, 2, 3, 4, 5],
      theme: 'game',
      activeTopic: 'vector',
    });
    expect(profile.skills).toEqual(guest.skills);
    expect(activeTopicOf(profile.student)).toBe('vector');
    expect(openItem(profile).item.ref.topic).toBe('vector');
  });

  it('stays on matrices after going back to them', () => {
    const guest = applyAction(vectorGuest(), { type: 'set_topic', topic: 'matrix' }).profile;
    const profile = startingProfile('user-1', 'game', asSent(guest));
    expect(profile.student.activeTopic).toBe('matrix');
    expect(profile.skills).toEqual(guest.skills);
    expect(openItem(profile).item.ref.topic).toBe('matrix');
  });

  it.each<[unknown]>([['physics'], ['Vector'], [7], [null]])(
    'lands on matrices when the topic is %j, which the server does not know, and keeps the rest',
    (activeTopic) => {
      const guest = vectorGuest();
      const profile = startingProfile('user-1', 'game', {
        ...asSent(guest),
        student: { ...guest.student, activeTopic },
      });
      expect(profile.student).toStrictEqual({
        id: 'user-1',
        units: [1, 2, 3, 4, 5],
        theme: 'game',
      });
      expect(profile.skills).toEqual(guest.skills);
      expect(profile.xp).toBe(guest.xp);
      expect(activeTopicOf(profile.student)).toBe('matrix');
      expect(openItem(profile).item.ref.topic).toBe('matrix');
    },
  );
});
