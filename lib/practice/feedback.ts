import { th } from '@/lib/content/th';
import { fillTokens } from '@/lib/core/tokens';
import type { Classification } from '@/lib/core/types';
import type { MisconceptionId } from '@/lib/topics/matrix/types';

export interface Feedback {
  tone: 'correct' | 'wrong';
  headline: string;
  detail?: string;
  /** SPEC §4: any wrong answer can open the worked solution. */
  offersWorked: boolean;
}

/** The message for this way of being wrong. Never contains the right answer (SPEC §9). */
export function misconceptionMessage(id: MisconceptionId, variant?: string): string {
  const entry: string | Record<string, string> = th.feedback.misconceptions[id];
  if (typeof entry === 'string') return entry;
  return (variant !== undefined && entry[variant]) || th.hints[id];
}

/** SPEC §9. Runs on the client with no network, so it appears as soon as the answer is sent. */
export function feedbackFor(classification: Classification): Feedback {
  switch (classification.type) {
    case 'correct':
      return { tone: 'correct', headline: th.feedback.correct, offersWorked: false };
    case 'misconception':
      return {
        tone: 'wrong',
        headline: th.feedback.wrong,
        detail: misconceptionMessage(classification.id as MisconceptionId, classification.variant),
        offersWorked: true,
      };
    case 'slip': {
      const [i, j] = classification.cell;
      return {
        tone: 'wrong',
        headline: th.feedback.almost,
        detail: fillTokens(th.feedback.slip, { i: String(i), j: String(j) }),
        offersWorked: true,
      };
    }
    case 'shape_error':
    case 'unknown':
      return {
        tone: 'wrong',
        headline: th.feedback.wrong,
        detail: th.feedback.unknown,
        offersWorked: true,
      };
  }
}
