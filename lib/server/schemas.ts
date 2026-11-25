import { z } from 'zod';
import { AVATARS, COHORT_PATTERN, MAX_COHORT, MAX_DISPLAY_NAME, THEMES } from '@/lib/sync/types';
import { packOf, registeredTopics, type TopicPack } from '@/lib/topics';

// Every request body is checked here before anything reads it (SPEC §15). Sizes are capped so that a
// forged request cannot make the server do a lot of work. Topics and skills come from the topic
// registry: a batch refused for one unknown topic would hold up every action queued behind it, so the
// server must know a topic before any device can send one (docs/VECTORS.md §6.2).

/** What the schemas need to know of a topic. */
export type SchemaTopic = Pick<TopicPack, 'id' | 'skills'>;

const MAX_ID_CHARS = 40;
const theme = z.enum(THEMES as [string, ...string[]]);
const avatar = z.enum(AVATARS);

const MAX_MATRIX_SIDE = 6;
const MAX_VECTOR_PARTS = 3;
const MAX_CELL_CHARS = 24;
const MAX_DURATION_MS = 24 * 60 * 60 * 1000;
// From 2020 to 2100: any clock time a device could sensibly claim.
const EARLIEST_AT = Date.UTC(2020, 0, 1);
const LATEST_AT = Date.UTC(2100, 0, 1);

const cell = z.string().max(MAX_CELL_CHARS);
const at = z.number().int().min(EARLIEST_AT).max(LATEST_AT);
const duration = z.number().int().min(0).max(MAX_DURATION_MS);

const storedAnswer = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('matrix'),
    value: z.array(z.array(cell).max(MAX_MATRIX_SIDE)).max(MAX_MATRIX_SIDE),
  }),
  z.strictObject({ kind: z.literal('scalar'), value: cell }),
  z.strictObject({
    kind: z.literal('dims'),
    rows: z.number().int().min(0).max(99),
    cols: z.number().int().min(0).max(99),
  }),
  z.strictObject({ kind: z.literal('choice'), id: z.string().max(40) }),
  // lib/core/answerJson.ts: a surd is one string such as "3√2", and a vector one per component.
  z.strictObject({ kind: z.literal('surd'), value: cell }),
  z.strictObject({ kind: z.literal('vector'), value: z.array(cell).max(MAX_VECTOR_PARTS) }),
  z.strictObject({ kind: z.literal('undefined') }),
]);

const hintLevel = z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]);

const caught = z.strictObject({
  id: z.string().max(40),
  variant: z.string().max(40).optional(),
});

export const MAX_BATCH = 50;

/** The sync request for these topics: each ref's skill must be one of its own topic's. */
export function syncRequestFor(topics: readonly SchemaTopic[]) {
  const ids = topics.map(({ id }) => id);
  if (ids.length === 0) throw new Error('syncRequestFor: no topics');
  const skillsOf = new Map<string, string[]>(
    topics.map(({ id, skills }) => [id, skills.map((one) => one.id)]),
  );
  const allSkills = topics.flatMap(({ skills }) => skills.map((one) => one.id));
  const skill = z.enum(allSkills as [string, ...string[]]);

  const itemRef = z
    .strictObject({
      topic: z.enum(ids as [string, ...string[]]),
      skill: z.string().max(MAX_ID_CHARS),
      difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]),
      seed: z.number().int(),
      target: z.string().max(MAX_ID_CHARS).optional(),
      targetVariant: z.string().max(MAX_ID_CHARS).optional(),
      gv: z.number().int(),
    })
    .refine((ref) => skillsOf.get(ref.topic)?.includes(ref.skill) === true, {
      path: ['skill'],
    });

  const sceneRequest = z.discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('remediate'), ref: itemRef, answer: storedAnswer, caught }),
    z.strictObject({ kind: z.literal('reveal'), ref: itemRef }),
  ]);

  const action = z.discriminatedUnion('type', [
    z.strictObject({ type: z.literal('start') }),
    z.strictObject({ type: z.literal('practice'), skill }),
    z.strictObject({ type: z.literal('hint') }),
    z.strictObject({
      type: z.literal('attempt'),
      ref: itemRef,
      answer: storedAnswer,
      hintLevel,
      timeMs: duration,
      at,
    }),
    z.strictObject({
      type: z.literal('help'),
      ref: itemRef,
      nth: z.number().int().min(0).max(1000),
    }),
    z.strictObject({ type: z.literal('finish_scene') }),
    z.strictObject({ type: z.literal('finish_turn') }),
    z.strictObject({ type: z.literal('note_worked'), request: sceneRequest }),
    z.strictObject({
      type: z.literal('scene_view'),
      view: z.strictObject({
        template: z.string().max(40),
        purpose: z.enum(['intro', 'concept', 'remediate', 'request', 'reveal']),
        beatsTotal: z.number().int().min(0).max(100),
        beatsSeen: z.number().int().min(0).max(100),
        replays: z.number().int().min(0).max(1000),
        skipped: z.boolean(),
        durationMs: duration,
      }),
    }),
    z.strictObject({ type: z.literal('set_theme'), theme }),
    z.strictObject({ type: z.literal('set_topic'), topic: z.enum(ids as [string, ...string[]]) }),
  ]);

  const request = z.strictObject({
    // It becomes a field name in the database, where a dot or a $ would mean something.
    deviceId: z
      .string()
      .min(8)
      .max(64)
      .regex(/^[\w-]+$/),
    actions: z
      .array(z.strictObject({ seq: z.number().int().min(1), action }))
      .min(1)
      .max(MAX_BATCH),
  });

  return request;
}

export const syncRequest = syncRequestFor(registeredTopics().map((topic) => packOf(topic)));

const displayName = z
  .string()
  .trim()
  .min(1)
  .max(MAX_DISPLAY_NAME)
  // No line breaks or control characters on anyone else's leaderboard, and none of the invisible
  // ones that turn text around or hide in it, with which one name can pass for another. The joiner
  // inside emoji such as 👩‍💻 stays.
  .regex(/^[^\p{Cc}\u200B\u200E\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF]+$/u);

export const welcomeRequest = z.strictObject({
  displayName,
  avatar,
  theme,
  consent: z.literal(true),
  cohort: z.string().trim().max(MAX_COHORT).regex(COHORT_PATTERN).optional(),
  // Only its progress is read, and only once, by `importGuestProfile`.
  guestProfile: z.looseObject({}).optional(),
});

export const accountUpdate = z
  .strictObject({
    displayName: displayName.optional(),
    avatar: avatar.optional(),
    showOnLeaderboard: z.boolean().optional(),
  })
  .refine((update) => Object.keys(update).length > 0);

export const assessmentSubmit = z.strictObject({
  startedAt: at,
  answers: z
    .array(
      z.strictObject({
        itemNo: z.number().int().min(1).max(14),
        answer: storedAnswer.nullable(),
        timeMs: duration,
      }),
    )
    .max(14),
});
