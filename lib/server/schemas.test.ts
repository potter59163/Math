import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { cohortFromLink } from '@/lib/sync/types';
import { packOf } from '@/lib/topics';
import {
  accountUpdate,
  syncRequest,
  syncRequestFor,
  welcomeRequest,
  type SchemaTopic,
} from './schemas';

const welcome = (cohort: string | null) => ({
  displayName: 'ทดสอบ',
  avatar: 'sigma',
  theme: 'game',
  consent: true,
  ...(cohort && { cohort }),
});

describe('a trial link', () => {
  it.each(['m5-1', 'ห้องA', 'ม.5/1'])('keeps %s as the group', (label) => {
    expect(cohortFromLink(label)).toBe(label);
    expect(welcomeRequest.safeParse(welcome(label)).success).toBe(true);
  });

  it('drops what could not be kept', () => {
    expect(cohortFromLink(null)).toBeNull();
    expect(cohortFromLink('   ')).toBeNull();
    expect(cohortFromLink('x'.repeat(33))).toBeNull();
    expect(cohortFromLink('a\u0000b')).toBeNull();
  });

  it('never stops a student at the welcome screen, whatever the link holds', () => {
    fc.assert(
      fc.property(fc.string({ unit: 'binary', maxLength: 40 }), (text) => {
        const fromLink = new URLSearchParams([['cohort', text]]).get('cohort');
        expect(welcomeRequest.safeParse(welcome(cohortFromLink(fromLink))).success).toBe(true);
      }),
    );
  });
});

describe('a chosen name', () => {
  const named = (displayName: string) =>
    welcomeRequest.safeParse({ ...welcome(null), displayName }).success;

  it.each(['ทดสอบ', 'Potter', 'น้องพี 👩‍💻', 'ม.5/1 เบอร์ 7'])('takes %s', (name) => {
    expect(named(name)).toBe(true);
  });

  it.each([
    ['a line break', 'สอง\nบรรทัด'],
    ['a right-to-left override', 'abc\u202Edcba'],
    ['an isolate', '\u2067ชื่อ\u2069'],
    ['a zero-width space', 'ชื่อ\u200B'],
    // At either end it is trimmed away like a space, so only one inside a name can do harm.
    ['a byte-order mark', 'ชื่อ\uFEFFเล่น'],
    ['nothing but spaces', '   '],
  ])('refuses %s, with which one name could pass for another', (_what, name) => {
    expect(named(name)).toBe(false);
  });
});

describe('a change to the account', () => {
  it('takes the switch that shows the photo on the leaderboard, on or off', () => {
    expect(accountUpdate.safeParse({ showPhoto: true }).success).toBe(true);
    expect(accountUpdate.safeParse({ showPhoto: false }).success).toBe(true);
    expect(accountUpdate.safeParse({ showPhoto: true, showOnLeaderboard: true }).success).toBe(
      true,
    );
  });

  it('refuses a switch that is not on or off, a key of its own choosing, and a change of nothing', () => {
    expect(accountUpdate.safeParse({ showPhoto: 'yes' }).success).toBe(false);
    expect(accountUpdate.safeParse({ photoKey: 'abc' }).success).toBe(false);
    expect(accountUpdate.safeParse({ photoAt: '2026-11-27T00:00:00.000Z' }).success).toBe(false);
    expect(accountUpdate.safeParse({}).success).toBe(false);
  });
});

describe('a device id', () => {
  const accepted = (deviceId: string) =>
    syncRequest.safeParse({ deviceId, actions: [{ seq: 1, action: { type: 'start' } }] }).success;

  it.each(['c0a8012e-7f4b-4c1d-9a55-0e9d6f3a1b2c', '0123456789abcdef0123456789abcdef'])(
    'takes %s, as a browser makes them',
    (deviceId) => {
      expect(accepted(deviceId)).toBe(true);
    },
  );

  it.each(['a.b.c.d.e.f', '$where-device', '__proto__.x', 'has a space', 'short'])(
    'refuses %s, which would mean something as a field name in the database',
    (deviceId) => {
      expect(accepted(deviceId)).toBe(false);
    },
  );
});

describe('topics in a sync batch (docs/VECTORS.md §6.2)', () => {
  const ref = (topic: string, skill: string) => ({
    topic,
    skill,
    difficulty: 1,
    seed: 7,
    gv: 1,
  });
  const attempt = (topic: string, skill: string, answer: unknown) => ({
    type: 'attempt',
    ref: ref(topic, skill),
    answer,
    hintLevel: 0,
    timeMs: 1000,
    at: Date.UTC(2026, 10, 24),
  });
  const batch = (...actions: unknown[]) => ({
    deviceId: 'c0a8012e-7f4b-4c1d-9a55-0e9d6f3a1b2c',
    actions: actions.map((action, index) => ({ seq: index + 1, action })),
  });

  // Stands in for the vector pack, which registers later: only its id and skills matter here.
  const vectorTopic: SchemaTopic = {
    id: 'vector',
    skills: [
      { id: 'v_points', unit: 12, nameTh: 'เวกเตอร์จากจุดสองจุด', prereq: [], maxLevel: 3 },
      { id: 'v_magnitude', unit: 13, nameTh: 'ขนาดของเวกเตอร์', prereq: [], maxLevel: 3 },
    ],
  };
  const both = syncRequestFor([packOf('matrix'), vectorTopic]);

  const matrixAttempt = attempt('matrix', 'mult', {
    kind: 'matrix',
    value: [
      ['1', '2'],
      ['3', '-4/5'],
    ],
  });

  it('takes a batch that mixes topics, once both are registered', () => {
    const mixed = batch(
      matrixAttempt,
      attempt('vector', 'v_points', { kind: 'vector', value: ['1', '-2', '3√2'] }),
      attempt('vector', 'v_magnitude', { kind: 'surd', value: '-√3/2' }),
      { type: 'practice', skill: 'v_points' },
      { type: 'set_topic', topic: 'vector' },
      { type: 'practice', skill: 'dim' },
    );
    expect(both.safeParse(mixed).success).toBe(true);
  });

  it('checks a skill against its own topic', () => {
    expect(
      both.safeParse(batch(attempt('matrix', 'v_points', { kind: 'undefined' }))).success,
    ).toBe(false);
    expect(both.safeParse(batch(attempt('vector', 'mult', { kind: 'undefined' }))).success).toBe(
      false,
    );
  });

  it('refuses a topic that is not registered', () => {
    const physics = batch(attempt('physics', 'mult', { kind: 'undefined' }));
    expect(both.safeParse(physics).success).toBe(false);
    expect(both.safeParse(batch({ type: 'set_topic', topic: 'physics' })).success).toBe(false);
    expect(syncRequest.safeParse(physics).success).toBe(false);
  });

  it('takes vectors now that the vector pack is registered', () => {
    expect(
      syncRequest.safeParse(batch(attempt('vector', 'v_points', { kind: 'undefined' }))).success,
    ).toBe(true);
    expect(syncRequest.safeParse(batch({ type: 'set_topic', topic: 'vector' })).success).toBe(true);
  });

  it('takes the matrix batch it always took', () => {
    expect(
      syncRequest.safeParse(batch(matrixAttempt, { type: 'set_topic', topic: 'matrix' })).success,
    ).toBe(true);
  });

  it('stores a surd as one string and a vector as one per component', () => {
    const answers = [
      { kind: 'surd', value: '3√2' },
      { kind: 'vector', value: ['1', '√2/2'] },
    ];
    for (const answer of answers) {
      expect(syncRequest.safeParse(batch(attempt('matrix', 'dim', answer))).success).toBe(true);
    }
    const wrong = [
      { kind: 'surd', value: ['3√2'] },
      { kind: 'vector', value: '1,2' },
      { kind: 'vector', value: ['1', '2', '3', '4'] },
    ];
    for (const answer of wrong) {
      expect(syncRequest.safeParse(batch(attempt('matrix', 'dim', answer))).success).toBe(false);
    }
  });
});
