import { z } from 'zod';
import { newProfile } from '@/lib/director/turn';
import type { Profile } from '@/lib/director/types';
import { ALL_UNITS } from '@/lib/learner/progress';
import type { ThemeId } from '@/lib/learner/types';
import { allSkills, isRegisteredTopic } from '@/lib/topics';
import type { SkillId, TopicId } from '@/lib/topics/types';

// A student's first server copy, which may start from what they did as a guest on this device.

const level = z.union([z.literal(1), z.literal(2), z.literal(3)]);

const skillState = z.object({
  pKnown: z.number().min(0).max(1),
  level,
  attempts: z
    .array(
      z.object({
        level,
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

const misconceptionState = z.object({
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
  relapses: z.number().int().min(0).optional(),
  rewarded: z.boolean(),
  fromPretest: z.boolean().optional(),
});

/**
 * What is carried over, for skills of these topics. One unknown skill drops the whole guest profile, so
 * it takes every registered topic's skills: a guest who tried vectors keeps their matrices too.
 */
export function guestProgressFor(skills: readonly SkillId[]) {
  const skillIds = z.enum(skills as [string, ...string[]]);
  return z.object({
    counter: z.number().int().min(0),
    xp: z.number().int().min(0),
    combo: z.number().int().min(0),
    bestCombo: z.number().int().min(0),
    itemsDone: z.number().int().min(0),
    skills: z.partialRecord(skillIds, skillState),
    misconceptions: z.record(z.string().max(40), misconceptionState),
    clipsSeen: z.array(skillIds),
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
}

const guestProgress = guestProgressFor(allSkills().map(({ id }) => id));

/**
 * The topic the guest was learning, read apart from their progress so that one this server does not
 * know drops only itself. Nothing else of the guest's student is read: the id, units and theme are the
 * account's own.
 */
const guestTopic = z.object({
  student: z.object({ activeTopic: z.custom<TopicId>(isRegisteredTopic) }),
});

export function freshProfile(userId: string, theme: ThemeId): Profile {
  return newProfile({ id: userId, units: [...ALL_UNITS], theme });
}

/**
 * Keeps what a guest earned and the topic they were on, and drops anything open, since that was drawn
 * for the guest's id. It came from the browser, so whatever does not look right is simply not carried
 * over. It cannot touch the leaderboard, which counts only attempts the server saw.
 */
export function startingProfile(userId: string, theme: ThemeId, guest: unknown): Profile {
  const fresh = freshProfile(userId, theme);
  const parsed = guestProgress.safeParse(guest);
  if (!parsed.success) return fresh;
  const topic = guestTopic.safeParse(guest);
  const student = topic.success
    ? { ...fresh.student, activeTopic: topic.data.student.activeTopic }
    : fresh.student;
  return { ...fresh, ...parsed.data, student } as Profile;
}
