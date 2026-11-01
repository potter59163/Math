import { z } from 'zod';
import { SKILLS } from '@/lib/topics/matrix/skills';
import { AVATARS, MAX_DISPLAY_NAME, THEMES } from '@/lib/sync/types';

// Every request body is checked here before anything reads it (SPEC §15). Sizes are capped so that a
// forged request cannot make the server do a lot of work.

const SKILL_IDS = SKILLS.map(({ id }) => id) as [string, ...string[]];
const skill = z.enum(SKILL_IDS);
const theme = z.enum(THEMES as [string, ...string[]]);
const avatar = z.enum(AVATARS);

const MAX_MATRIX_SIDE = 6;
const MAX_CELL_CHARS = 24;
const MAX_DURATION_MS = 24 * 60 * 60 * 1000;
// From 2020 to 2100: any clock time a device could sensibly claim.
const EARLIEST_AT = Date.UTC(2020, 0, 1);
const LATEST_AT = Date.UTC(2100, 0, 1);

const cell = z.string().max(MAX_CELL_CHARS);
const at = z.number().int().min(EARLIEST_AT).max(LATEST_AT);
const duration = z.number().int().min(0).max(MAX_DURATION_MS);

const itemRef = z.strictObject({
  topic: z.literal('matrix'),
  skill,
  difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  seed: z.number().int(),
  target: z.string().max(40).optional(),
  targetVariant: z.string().max(40).optional(),
  gv: z.number().int(),
});

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
  z.strictObject({ kind: z.literal('undefined') }),
]);

const hintLevel = z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]);

const caught = z.strictObject({
  id: z.string().max(40),
  variant: z.string().max(40).optional(),
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
]);

export const MAX_BATCH = 50;

export const syncRequest = z.strictObject({
  deviceId: z.string().min(8).max(64),
  actions: z
    .array(z.strictObject({ seq: z.number().int().min(1), action }))
    .min(1)
    .max(MAX_BATCH),
});

const displayName = z
  .string()
  .trim()
  .min(1)
  .max(MAX_DISPLAY_NAME)
  // No line breaks or control characters on anyone else's leaderboard.
  .regex(/^[^\p{Cc}]+$/u);

export const welcomeRequest = z.strictObject({
  displayName,
  avatar,
  theme,
  consent: z.literal(true),
  cohort: z
    .string()
    .trim()
    .max(32)
    .regex(/^[A-Za-z0-9_-]*$/)
    .optional(),
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
