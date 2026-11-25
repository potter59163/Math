import { thVector } from '@/lib/content/th.vector';
import type { Answer } from '@/lib/core/types';
import type { TokenOptions, TokenValues } from '@/lib/topics/types';
import { rationalText, surdText, surdVecText } from './format';
import type { VectorItem } from './types';

// The values of the director's tokens for a vector item (AI_DIRECTOR §4.4). Only a few of the shared
// names mean anything here: which component, and the answers themselves.

/** The component the text talks about: the first one the answer, or else the target, gets wrong. */
function focusComponent(item: VectorItem, answer: Answer | undefined): number | null {
  const { correct } = item;
  if (correct.kind !== 'vector') return null;
  const other = answer ?? item.diagnostics[0]?.answer;
  if (other?.kind !== 'vector' || other.value.length !== correct.value.length) return null;
  const index = other.value.findIndex((part, i) => !part.equals(correct.value[i]));
  return index < 0 ? null : index + 1;
}

export function answerText(item: VectorItem, answer: Answer): string {
  switch (answer.kind) {
    case 'scalar':
      return rationalText(answer.value);
    case 'surd':
      return surdText(answer.value);
    case 'vector':
      return surdVecText(answer.value);
    case 'choice': {
      const option = item.options?.find(({ id }) => id === answer.id);
      return option ? thVector.choices[option.labelKey] : answer.id;
    }
    case 'matrix':
    case 'dims':
    case 'undefined':
      // A vector item never asks for these, but a student's device can still send one.
      return '';
  }
}

/** The values for this item and answer. A token with no meaning here has no value. */
export function resolveVectorTokens(
  item: VectorItem,
  answer: Answer | undefined,
  { revealAllowed }: TokenOptions,
): TokenValues {
  const values: TokenValues = {};
  const focus = focusComponent(item, answer);
  if (focus !== null) values.i = String(focus);
  if (answer) {
    const text = answerText(item, answer);
    if (text) values.studentAnswer = text;
  }
  if (revealAllowed) values.correctAnswer = answerText(item, item.correct);
  return values;
}
