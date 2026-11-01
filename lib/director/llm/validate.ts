import { tokensIn } from '@/lib/core/tokens';
import type { Candidate, FallbackReason } from '@/lib/director/types';
import { REVEALING_TOKENS, type TokenName, type TokenValues } from '@/lib/director/tokens';
import { LlmDecision, MAX_NARRATION_LINES, MAX_NARRATION_UNITS, MAX_REASON_UNITS } from './schema';

// AI_DIRECTOR §4.3. A choice or message that fails here is thrown away and the rules decide instead.

/** Arabic and Thai digits, and the superscripts that could say "k²" without a digit. */
const DIGITS = /[0-9๐-๙⁰¹²³⁴-⁹₀-₉]/;

/**
 * Number words let a sum through without a digit. These Thai words contain one by accident, and each is
 * common enough in a tutor's sentence to be worth telling apart. A rare miss only means falling back.
 */
const NUMBER_WORDS =
  /(?<!นิด|ครู่|อย่าง|ส่วน|ครั้ง)หนึ่ง|สอง|สาม(?!ารถ|เหลี่ยม)|สี่(?!เหลี่ยม)|(?<!ก)ห้า(?!ม)|หก(?!ล้ม)|เจ็ด|แปด|เก้า|สิบ|(?<!เรียบ)ร้อย|(?<!สัม)พัน(?!ธ)|ศูนย์/;

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
  /** This item's sizes as the engine has them. */
  sizes?: Pick<TokenValues, 'dimsA' | 'dimsB'>;
}

const normalSize = (size: string) => size.replace(/\s/g, '').replace(/x/i, '×');

/**
 * A size is the one number the tutor keeps writing, as in "det 3×3". If it is this item's own size it is
 * the engine's number already, so it becomes the token that shows it. Any other size is still refused.
 */
function sizesToTokens(text: string, sizes: ValidateInput['sizes'] = {}): string {
  return text.replace(/\d+\s*[×x]\s*\d+/gi, (written) => {
    const found = (['dimsA', 'dimsB'] as const).find(
      (name) => sizes[name] && normalSize(sizes[name]) === normalSize(written),
    );
    return found ? `{{${found}}}` : written;
  });
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
  sizes,
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

  const tokensAllowed = (line: string) =>
    !hasStrayBrace(line) &&
    tokensIn(line).every((token) => {
      const name = token as TokenName;
      return allowedTokens.includes(name) && (revealAllowed || !REVEALING_TOKENS.includes(name));
    });

  const message = sizesToTokens(decision.message, sizes);
  if (hasNumber(message)) return { ok: false, reason: 'digit_violation' };
  if (!tokensAllowed(message)) return { ok: false, reason: 'token_violation' };

  // Every clip has its own caption for every beat, so a line that fails costs only that line, and
  // never reaches a student any more than a message that fails does.
  const beats = chosen.scene?.beats ?? [];
  const narration = (decision.narration ?? [])
    .map((line) => ({ ...line, text: sizesToTokens(line.text, sizes) }))
    .filter(
      ({ beat, text }) =>
        beats.includes(beat) &&
        text.length > 0 &&
        text.length <= MAX_NARRATION_UNITS &&
        !hasNumber(text) &&
        tokensAllowed(text),
    )
    .slice(0, MAX_NARRATION_LINES);

  return {
    ok: true,
    chosen,
    decision: {
      ...decision,
      message,
      narration: narration.length > 0 ? narration : undefined,
      reason: decision.reason.slice(0, MAX_REASON_UNITS),
    },
  };
}
