import { tokensIn } from '@/lib/core/tokens';
import type { Candidate, FallbackReason } from '@/lib/director/types';
import { REVEALING_TOKENS, type TokenName } from '@/lib/director/tokens';
import { LlmDecision } from './schema';

// AI_DIRECTOR §4.3. Anything that fails here is thrown away and the rules decide instead.

/** Arabic and Thai digits, and the superscripts that could say "k²" without a digit. */
const DIGITS = /[0-9๐-๙⁰¹²³⁴-⁹₀-₉]/;

/**
 * Number words let a sum through without a digit. These Thai words contain one by accident, and each is
 * common enough in a tutor's sentence to be worth telling apart. A rare miss only means falling back.
 */
const NUMBER_WORDS =
  /หนึ่ง|สอง|สาม(?!ารถ)|สี่|(?<!ก)ห้า(?!ม)|หก(?!ล้ม)|เจ็ด|แปด|เก้า|สิบ|(?<!เรียบ)ร้อย|(?<!สัม)พัน(?!ธ)|ศูนย์/;

export function hasNumberInWords(text: string): boolean {
  return NUMBER_WORDS.test(text);
}

function hasNumber(text: string): boolean {
  return DIGITS.test(text) || hasNumberInWords(text);
}

/** Any brace that is not part of a whole {{token}} (rule 5). */
function hasStrayBrace(text: string): boolean {
  return /[{}]/.test(text.replace(/\{\{\w+\}\}/g, ''));
}

export interface ValidateInput {
  text: string;
  candidates: readonly Candidate[];
  allowedTokens: readonly TokenName[];
  revealAllowed: boolean;
}

export type Validated =
  { ok: true; decision: LlmDecision; chosen: Candidate } | { ok: false; reason: FallbackReason };

/** Providers sometimes wrap JSON in a code fence even when asked not to. */
function unfence(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');
}

export function validateDecision({
  text,
  candidates,
  allowedTokens,
  revealAllowed,
}: ValidateInput): Validated {
  let raw: unknown;
  try {
    raw = JSON.parse(unfence(text));
  } catch {
    return { ok: false, reason: 'schema_invalid' };
  }
  const parsed = LlmDecision.safeParse(raw);
  if (!parsed.success) return { ok: false, reason: 'schema_invalid' };
  const decision = parsed.data;

  const chosen = candidates.find(({ id }) => id === decision.choice);
  if (!chosen) return { ok: false, reason: 'choice_invalid' };

  const lines = decision.narration ?? [];
  const texts = [decision.message, ...lines.map((line) => line.text)];
  if (texts.some(hasNumber)) return { ok: false, reason: 'digit_violation' };

  for (const line of texts) {
    if (hasStrayBrace(line)) return { ok: false, reason: 'token_violation' };
    for (const token of tokensIn(line)) {
      const name = token as TokenName;
      if (!allowedTokens.includes(name)) return { ok: false, reason: 'token_violation' };
      if (!revealAllowed && REVEALING_TOKENS.includes(name)) {
        return { ok: false, reason: 'token_violation' };
      }
    }
  }

  const beats = chosen.scene?.beats ?? [];
  if (lines.some(({ beat }) => !beats.includes(beat))) return { ok: false, reason: 'beat_invalid' };

  return { ok: true, decision, chosen };
}
