import { z } from 'zod';

/**
 * AI_DIRECTOR §4.2. Captions around 56 code units already overflowed one line at 360px, and the player
 * has room for two, so a line of narration stops well short of three.
 */
export const MAX_MESSAGE_UNITS = 160;
export const MAX_NARRATION_UNITS = 70;
export const MAX_REASON_UNITS = 200;
export const MAX_NARRATION_LINES = 6;

export const LlmDecision = z.strictObject({
  choice: z.string().regex(/^c[1-4]$/),
  message: z.string().min(1).max(MAX_MESSAGE_UNITS),
  narration: z
    .array(
      z.strictObject({
        beat: z.string(),
        text: z.string().min(1).max(MAX_NARRATION_UNITS),
      }),
    )
    .max(MAX_NARRATION_LINES)
    .optional(),
  reason: z.string().min(1).max(MAX_REASON_UNITS),
});

export type LlmDecision = z.infer<typeof LlmDecision>;
