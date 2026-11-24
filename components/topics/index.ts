import type { ComponentType } from 'react';
import type { Item } from '@/lib/core/types';
import type { TopicId } from '@/lib/topics/types';
import { MatrixGivens } from './MatrixGivens';

// The UI half of a topic pack: whatever draws something only one topic has. Everything else on screen
// works from ItemKind and the pack's copy, so it is shared.

export interface TopicComponents {
  /** What an item gives under its question, such as the matrices A and B. */
  Givens: ComponentType<{ item: Item }>;
}

const COMPONENTS: Partial<Record<TopicId, TopicComponents>> = {
  matrix: { Givens: MatrixGivens },
};

const NOTHING: TopicComponents = { Givens: () => null };

/** A topic with no components of its own draws nothing extra, rather than failing. */
export function componentsOf(topic: string): TopicComponents {
  return COMPONENTS[topic as TopicId] ?? NOTHING;
}
