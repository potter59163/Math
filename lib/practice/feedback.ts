import { th } from '@/lib/content/th';
import type { Classification } from '@/lib/core/types';
import { DEFAULT_TOPIC, packOf, packOfMisconception } from '@/lib/topics';
import type { MisconceptionId, TopicId } from '@/lib/topics/types';

export interface Feedback {
  tone: 'correct' | 'wrong';
  headline: string;
  detail?: string;
  /** SPEC §4: any wrong answer can open the worked solution. */
  offersWorked: boolean;
}

/** The message for this way of being wrong. Never contains the right answer (SPEC §9). */
export function misconceptionMessage(id: MisconceptionId, variant?: string): string {
  return packOfMisconception(id).copy.misconceptionFeedback(id, variant);
}

/**
 * SPEC §9. Runs on the client with no network, so it appears as soon as the answer is sent. The topic
 * words a slip: a cell of a matrix, a component of a vector.
 */
export function feedbackFor(
  classification: Classification,
  topic: TopicId = DEFAULT_TOPIC,
): Feedback {
  switch (classification.type) {
    case 'correct':
      return { tone: 'correct', headline: th.feedback.correct, offersWorked: false };
    case 'misconception':
      return {
        tone: 'wrong',
        headline: th.feedback.wrong,
        detail: misconceptionMessage(classification.id, classification.variant),
        offersWorked: true,
      };
    case 'slip':
      return {
        tone: 'wrong',
        headline: th.feedback.almost,
        detail: packOf(topic).copy.slip(classification.cell),
        offersWorked: true,
      };
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
