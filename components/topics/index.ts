import type { ComponentType } from 'react';
import type { Item } from '@/lib/core/types';
import type { TopicId } from '@/lib/topics/types';
import { answerAffix as vectorAnswerAffix, type AnswerAffix } from '@/lib/topics/vector/display';
import { MatrixGivens } from './MatrixGivens';
import { VectorChoiceLabel, VectorGivens, VectorPrompt } from './VectorParts';

// The UI half of a topic pack: whatever draws something only one topic has. Everything else on screen
// works from ItemKind and the pack's copy, so it is shared.

export type { AnswerAffix };

export interface TopicComponents {
  /** What an item gives under its question, such as the matrices A and B. */
  Givens: ComponentType<{ item: Item }>;
  /** The question, when it holds more than words. Without it the pack's plain text is shown. */
  Prompt?: ComponentType<{ item: Item }>;
  /** A choice's label, when it holds more than words. Without it the pack's plain text is shown. */
  ChoiceLabel?: ComponentType<{ labelKey: string }>;
  /** Words either side of a number item's one box, such as θ = □ องศา. */
  answerAffix?(item: Item): AnswerAffix | null;
}

const COMPONENTS: Partial<Record<TopicId, TopicComponents>> = {
  matrix: { Givens: MatrixGivens },
  vector: {
    Givens: VectorGivens,
    Prompt: VectorPrompt,
    ChoiceLabel: VectorChoiceLabel,
    answerAffix: (item) => vectorAnswerAffix(item as Parameters<typeof vectorAnswerAffix>[0]),
  },
};

const NOTHING: TopicComponents = { Givens: () => null };

/** A topic with no components of its own draws nothing extra, rather than failing. */
export function componentsOf(topic: string): TopicComponents {
  return COMPONENTS[topic as TopicId] ?? NOTHING;
}
