import { fillTokens, tokensIn } from '@/lib/core/tokens';
import type { Answer, Item } from '@/lib/core/types';
import { packOf } from '@/lib/topics';
import type { TokenName, TokenOptions, TokenValues } from '@/lib/topics/types';

// Numbers reach a student's text only through these tokens (AI_DIRECTOR §4.4). The LLM writes the
// token, and the item's topic pack fills it with the engine's value.

export { REVEALING_TOKENS } from '@/lib/topics/types';
export type { TokenName, TokenValues };

type Options = TokenOptions;

/** The values for this item and answer. A token with no meaning here has no value. */
export function resolveTokens(
  item: Item,
  answer: Answer | undefined,
  options: Options,
): TokenValues {
  return packOf(item.ref.topic).tokens(item, answer, options);
}

/** `allowedTokens` of AI_DIRECTOR §4.1. */
export function allowedTokens(
  item: Item,
  answer: Answer | undefined,
  options: Options,
): TokenName[] {
  return Object.keys(resolveTokens(item, answer, options)) as TokenName[];
}

/** Fills student-facing text. A token that is not allowed here throws, so it can never get through. */
export function fillStudentText(
  text: string,
  item: Item,
  answer: Answer | undefined,
  options: Options,
): string {
  const values = resolveTokens(item, answer, options);
  const missing = tokensIn(text).filter((token) => !(token in values));
  if (missing.length > 0) throw new Error(`fillStudentText: no value for ${missing.join(', ')}`);
  return fillTokens(text, values);
}
