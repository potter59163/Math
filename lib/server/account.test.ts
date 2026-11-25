import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import type { Profile } from '@/lib/director/types';
import { ALL_UNITS } from '@/lib/learner/progress';
import type { MisconceptionState, SkillState, ThemeId } from '@/lib/learner/types';
import { runStudent } from '@/lib/sim/run';
import { planned } from '@/lib/sim/students';
import { activeTopicOf, allSkills, isRegisteredTopic, packOf } from '@/lib/topics';
import { freshProfile, guestProgressFor, startingProfile } from './account';

// Vectors are off in this file, as they are in production until NEXT_PUBLIC_TOPICS names them.

const state: SkillState = {
  pKnown: 0.4,
  level: 1,
  attempts: [{ level: 1, countsCorrect: true, clean: true, timeMs: 1200 }],
  passed: false,
  wrongStreak: 0,
  stuck: false,
  lastSeen: 1,
};

const guest = (skills: Record<string, SkillState>, clipsSeen: string[]) => ({
  counter: 3,
  xp: 30,
  combo: 2,
  bestCombo: 2,
  itemsDone: 3,
  skills,
  misconceptions: {},
  clipsSeen,
  lastReviewAt: 0,
});

/** Fixed, then caught again: the state onCaught leaves after a relapse. */
const relapsed: MisconceptionState = {
  status: 'active',
  count: 4,
  fixStreak: 0,
  scenesSeen: 2,
  openedAtItem: 9,
  openedAtMs: 1_800_000_540_000,
  lastCaughtAtItem: 9,
  itemsToResolve: 4,
  msToResolve: 240_000,
  relapses: 1,
  rewarded: true,
};

describe('a guest profile carried over', () => {
  it('keeps matrix progress', () => {
    const profile = startingProfile('user-1', 'game', guest({ dim: state }, ['dim']));
    expect(profile.skills.dim).toEqual(state);
    expect(profile.xp).toBe(30);
    expect(profile.student).toEqual({ id: 'user-1', units: [1, 2, 3, 4, 5], theme: 'game' });
  });

  it('keeps both topics once both are registered', () => {
    const schema = guestProgressFor([...allSkills().map(({ id }) => id), 'v_points']);
    const parsed = schema.safeParse(guest({ dim: state, v_points: state }, ['dim', 'v_points']));
    expect(parsed.success).toBe(true);
    expect(parsed.data?.skills).toEqual({ dim: state, v_points: state });
  });

  it('drops a profile with a skill of no registered topic, as it always has', () => {
    const profile = startingProfile('user-1', 'game', guest({ dim: state, physics: state }, []));
    expect(profile.skills).toEqual({});
    expect(profile.xp).toBe(0);
  });

  it('keeps how often each misconception came back after it was fixed', () => {
    const profile = startingProfile('user-1', 'game', {
      ...guest({ transpose: state }, ['transpose']),
      misconceptions: { M03_TRANSPOSE_WRONG: relapsed },
    });
    expect(profile.misconceptions.M03_TRANSPOSE_WRONG).toEqual(relapsed);
    expect(profile.misconceptions.M03_TRANSPOSE_WRONG?.relapses).toBe(1);
  });

  it.each<[unknown]>([[-1], [1.5], ['1'], [null]])(
    'drops a profile with a relapse count of %j, which no device writes, like any field that looks wrong',
    (relapses) => {
      const profile = startingProfile('user-1', 'game', {
        ...guest({ transpose: state }, ['transpose']),
        misconceptions: { M03_TRANSPOSE_WRONG: { ...relapsed, relapses } },
      });
      expect(profile).toStrictEqual(freshProfile('user-1', 'game'));
    },
  );
});

describe('the topic a guest was on', () => {
  const guestStudent = { id: 'guest-3f2a', units: [1, 2, 3, 4, 5], theme: 'shop' };
  const withStudent = (student: unknown) => ({ ...guest({ dim: state }, ['dim']), student });

  it('is kept, while the id, units and theme come from the account', () => {
    const profile = startingProfile(
      'user-1',
      'game',
      withStudent({ ...guestStudent, activeTopic: 'vector' }),
    );
    expect(profile.student).toEqual({
      id: 'user-1',
      units: [1, 2, 3, 4, 5],
      theme: 'game',
      activeTopic: 'vector',
    });
    expect(profile.skills.dim).toEqual(state);
    expect(profile.xp).toBe(30);
  });

  it('changes nothing while that topic is switched off', () => {
    const profile = startingProfile(
      'user-1',
      'game',
      withStudent({ ...guestStudent, activeTopic: 'vector' }),
    );
    expect(activeTopicOf(profile.student)).toBe('matrix');
  });

  it.each<[unknown]>([['physics'], [''], ['Vector'], [' vector'], [42], [null], [true], [{}]])(
    'is dropped when it is %j, and the rest still comes over',
    (activeTopic) => {
      const profile = startingProfile(
        'user-1',
        'game',
        withStudent({ ...guestStudent, activeTopic }),
      );
      expect(profile.student).toStrictEqual({
        id: 'user-1',
        units: [1, 2, 3, 4, 5],
        theme: 'game',
      });
      expect(profile.skills.dim).toEqual(state);
      expect(profile.xp).toBe(30);
    },
  );

  it.each<[unknown]>([[null], ['guest-3f2a'], [7], [['vector']], [{ activeTopic: ['vector'] }]])(
    'is not found in a student that is %j, and the rest still comes over',
    (student) => {
      const profile = startingProfile('user-1', 'game', withStudent(student));
      expect(profile.student).toStrictEqual({
        id: 'user-1',
        units: [1, 2, 3, 4, 5],
        theme: 'game',
      });
      expect(profile.xp).toBe(30);
    },
  );

  it('is not kept from a profile that is dropped', () => {
    const profile = startingProfile('user-1', 'game', {
      ...guest({ dim: state, physics: state }, []),
      student: { ...guestStudent, activeTopic: 'vector' },
    });
    expect(profile).toStrictEqual(freshProfile('user-1', 'game'));
  });
});

// The import as it was before it kept relapse counts and the topic (lib/server/account.ts at dceb45e),
// copied unchanged. A guest with no vector attempt must still get what this gives, apart from those.

const levelBefore = z.union([z.literal(1), z.literal(2), z.literal(3)]);

const skillStateBefore = z.object({
  pKnown: z.number().min(0).max(1),
  level: levelBefore,
  attempts: z
    .array(
      z.object({
        level: levelBefore,
        countsCorrect: z.boolean(),
        clean: z.boolean(),
        timeMs: z.number().min(0),
      }),
    )
    .max(5000),
  passed: z.boolean(),
  wrongStreak: z.number().int().min(0),
  stuck: z.boolean(),
  lastSeen: z.number().int().min(0),
  pretestCorrect: z.boolean().optional(),
});

const misconceptionStateBefore = z.object({
  status: z.enum(['suspected', 'active', 'resolved']),
  count: z.number().int().min(0),
  fixStreak: z.number().int().min(0),
  variant: z.string().max(40).optional(),
  scenesSeen: z.number().int().min(0),
  openedAtItem: z.number().int().min(0),
  openedAtMs: z.number().min(0),
  lastCaughtAtItem: z.number().int().min(0),
  itemsToResolve: z.number().int().min(0).optional(),
  msToResolve: z.number().min(0).optional(),
  rewarded: z.boolean(),
  fromPretest: z.boolean().optional(),
});

const skillIdsBefore = z.enum(allSkills().map(({ id }) => id) as [string, ...string[]]);

const guestProgressBefore = z.object({
  counter: z.number().int().min(0),
  xp: z.number().int().min(0),
  combo: z.number().int().min(0),
  bestCombo: z.number().int().min(0),
  itemsDone: z.number().int().min(0),
  skills: z.partialRecord(skillIdsBefore, skillStateBefore),
  misconceptions: z.record(z.string().max(40), misconceptionStateBefore),
  clipsSeen: z.array(skillIdsBefore),
  lastReviewAt: z.number().int().min(0),
  activity: z
    .array(
      z.object({
        day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        items: z.number().int().min(0),
        xp: z.number().int().min(0),
      }),
    )
    .max(400)
    .optional(),
  recentItems: z.array(z.string().max(16)).max(30).optional(),
});

function startingProfileBefore(userId: string, theme: ThemeId, guest: unknown): Profile {
  const fresh = freshProfile(userId, theme);
  const parsed = guestProgressBefore.safeParse(guest);
  return parsed.success ? ({ ...fresh, ...parsed.data } as Profile) : fresh;
}

/** A guest profile as the welcome request carries it: JSON, from the browser. */
interface GuestBody {
  student?: unknown;
  misconceptions?: Record<string, { relapses?: number } | undefined>;
}

const topicOf = (student: unknown): unknown =>
  typeof student === 'object' && student !== null && 'activeTopic' in student
    ? student.activeTopic
    : undefined;

/**
 * What the import gives now: what it gave before, with each relapse count back and, for a guest who
 * chose matrices on the topic tab, that choice. A profile dropped before is dropped now.
 */
function expectedNow(before: Profile, guest: GuestBody): Profile {
  if (!guestProgressBefore.safeParse(guest).success) return before;
  const misconceptions = Object.fromEntries(
    Object.entries(before.misconceptions).map(([id, kept]) => {
      const relapses = guest.misconceptions?.[id]?.relapses;
      return [id, kept && relapses !== undefined ? { ...kept, relapses } : kept] as const;
    }),
  );
  const student =
    topicOf(guest.student) === 'matrix'
      ? { ...before.student, activeTopic: 'matrix' as const }
      : before.student;
  return { ...before, misconceptions, student };
}

const asSent = <T>(body: T): T => JSON.parse(JSON.stringify(body)) as T;

describe('a guest with no vector attempt, against the import as it was', () => {
  const MATRIX = packOf('matrix');
  const skillIds = MATRIX.skills.map(({ id }) => id);
  const misconceptionIds = MATRIX.catalog.map(({ id }) => id);
  const themes: ThemeId[] = ['shop', 'game', 'sport', 'music', 'food'];

  const upTo = (max: number) => fc.nat({ max });
  const level = fc.constantFrom(1, 2, 3);
  const clock = fc.maxSafeNat();
  const day = fc
    .date({ min: new Date('2026-01-01'), max: new Date('2027-12-31'), noInvalidDate: true })
    .map((date) => date.toISOString().slice(0, 10));

  const skillState = fc.record(
    {
      pKnown: fc.double({ min: 0, max: 1, noNaN: true }),
      level,
      attempts: fc.array(
        fc.record({
          level,
          countsCorrect: fc.boolean(),
          clean: fc.boolean(),
          timeMs: upTo(3_600_000),
        }),
        { maxLength: 6 },
      ),
      passed: fc.boolean(),
      wrongStreak: upTo(5),
      stuck: fc.boolean(),
      lastSeen: upTo(2000),
      pretestCorrect: fc.boolean(),
    },
    {
      requiredKeys: ['pKnown', 'level', 'attempts', 'passed', 'wrongStreak', 'stuck', 'lastSeen'],
    },
  );

  const misconceptionState = fc.record(
    {
      status: fc.constantFrom('suspected', 'active', 'resolved'),
      count: upTo(40),
      fixStreak: upTo(2),
      variant: fc.string({ maxLength: 40 }),
      scenesSeen: upTo(10),
      openedAtItem: upTo(2000),
      openedAtMs: clock,
      lastCaughtAtItem: upTo(2000),
      itemsToResolve: upTo(200),
      msToResolve: clock,
      relapses: upTo(20),
      rewarded: fc.boolean(),
      fromPretest: fc.boolean(),
    },
    {
      requiredKeys: [
        'status',
        'count',
        'fixStreak',
        'scenesSeen',
        'openedAtItem',
        'openedAtMs',
        'lastCaughtAtItem',
        'rewarded',
      ],
    },
  );

  const guestId = fc.uuid().map((id) => `guest-${id}`);
  const units = fc.constant([...ALL_UNITS]);
  const unknownTopic = fc.oneof(
    fc.string({ maxLength: 12 }).filter((topic) => !isRegisteredTopic(topic)),
    fc.constantFrom('Matrix', 'vectors', 'physics', ''),
    fc.integer(),
    fc.constantFrom(null, true, {}, ['matrix']),
  );
  const student = fc.oneof(
    // Every guest today: with one topic switched on, no topic tab is ever shown.
    fc.record(
      { id: guestId, units, theme: fc.constantFrom(...themes) },
      { requiredKeys: ['id', 'units'] },
    ),
    // Chose matrices on the topic tab, once vectors are on.
    fc.record({
      id: guestId,
      units,
      theme: fc.constantFrom(...themes),
      activeTopic: fc.constant('matrix'),
    }),
    // A topic this server does not know.
    fc.record({ id: guestId, units, activeTopic: unknownTopic }),
    // Not a student at all.
    fc.constantFrom(null, 'guest', 7, []),
  );

  const matrixGuest = fc.record(
    {
      student,
      counter: upTo(5000),
      xp: upTo(50_000),
      combo: upTo(50),
      bestCombo: upTo(50),
      itemsDone: upTo(2000),
      skills: fc.dictionary(fc.constantFrom(...skillIds), skillState, { maxKeys: skillIds.length }),
      misconceptions: fc.dictionary(fc.constantFrom(...misconceptionIds), misconceptionState, {
        maxKeys: 6,
      }),
      clipsSeen: fc.subarray(skillIds),
      lastReviewAt: upTo(2000),
      activity: fc.array(fc.record({ day, items: upTo(200), xp: upTo(2000) }), { maxLength: 8 }),
      recentItems: fc.array(fc.string({ maxLength: 16 }), { maxLength: 30 }),
      // Open things, drawn for the guest's id, which never come over.
      current: fc.record({
        ref: fc.record({
          topic: fc.constant('matrix'),
          skill: fc.constantFrom(...skillIds),
          difficulty: level,
          seed: fc.integer(),
          gv: fc.constant(2),
        }),
        hintLevel: fc.constantFrom(0, 1, 2, 3),
      }),
      pending: fc.jsonValue({ maxDepth: 2 }),
      path: fc.array(fc.jsonValue({ maxDepth: 1 }), { maxLength: 3 }),
    },
    {
      requiredKeys: [
        'counter',
        'xp',
        'combo',
        'bestCombo',
        'itemsDone',
        'skills',
        'misconceptions',
        'clipsSeen',
        'lastReviewAt',
      ],
    },
  );

  /** Ways a guest profile was dropped, which must drop it still. */
  const spoilers: ((body: Record<string, unknown>) => Record<string, unknown>)[] = [
    (body) => ({ ...body, xp: -1 }),
    (body) => ({ ...body, skills: { ...(body.skills as object), physics: state } }),
    (body) => ({ ...body, clipsSeen: ['physics'] }),
    (body) => ({ ...body, misconceptions: { ['M'.repeat(41)]: relapsed } }),
  ];
  const guestBody = fc
    .tuple(
      matrixGuest,
      fc.oneof(
        { arbitrary: fc.constant(null), weight: 4 },
        { arbitrary: fc.constantFrom(...spoilers), weight: 1 },
      ),
    )
    .map(([body, spoil]) => asSent(spoil ? spoil(body) : body) as GuestBody);

  it('gets what it got before, apart from its relapse counts, and plans in the same topic', () => {
    fc.assert(
      fc.property(guestBody, (body) => {
        const before = startingProfileBefore('user-1', 'game', body);
        const now = startingProfile('user-1', 'game', body);
        expect(now).toStrictEqual(expectedNow(before, body));
        for (const enabled of [['matrix'], ['matrix', 'vector']]) {
          expect(activeTopicOf(now.student, enabled)).toBe(activeTopicOf(before.student, enabled));
        }
      }),
      { numRuns: 1000 },
    );
  });

  it('gets what it got before after real sessions, apart from the relapses it now keeps', () => {
    const guests = [0.5, 0.6, 0.7].flatMap((rate) =>
      [1, 2, 3, 4].map(
        (seed) =>
          runStudent({
            id: `guest-${rate}-${seed}`,
            student: planned(rate, seed),
            units: [...ALL_UNITS],
            items: 80,
          }).profile,
      ),
    );
    const relapses = (profile: Profile) =>
      Object.values(profile.misconceptions).filter((kept) => (kept?.relapses ?? 0) > 0).length;
    // Without one, this would show nothing about relapses.
    expect(guests.filter((profile) => relapses(profile) > 0).length).toBeGreaterThan(0);

    for (const played of guests) {
      const body = asSent(played);
      const before = startingProfileBefore('user-1', 'game', body);
      const now = startingProfile('user-1', 'game', body);
      expect(now).toStrictEqual(expectedNow(before, body));
      expect(relapses(now)).toBe(relapses(played));
      expect(now.student).toEqual({ id: 'user-1', units: [1, 2, 3, 4, 5], theme: 'game' });
    }
  });
});
