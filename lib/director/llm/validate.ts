import { tokensIn } from '@/lib/core/tokens';
import type { Candidate, FallbackReason } from '@/lib/director/types';
import { REVEALING_TOKENS, type TokenName, type TokenValues } from '@/lib/director/tokens';
import { LlmDecision, MAX_NARRATION_LINES, MAX_NARRATION_UNITS, MAX_REASON_UNITS } from './schema';

// AI_DIRECTOR §4.3. A choice or message that fails here is thrown away and the rules decide instead.

/**
 * Any character Unicode counts as a number (Arabic, Thai, fullwidth and Lao digits, superscripts and
 * subscripts, ½, ①, Ⅱ, mathematical bold digits) and the keycap emoji that can draw one.
 */
const DIGITS = /[\p{N}\u{1F51F}\u20E3]/u;

/** The inverse of a named matrix, A⁻¹ or (AB)⁻¹: a name. Its ¹ alone is taken out before the check. */
const INVERSE = /([A-Z)])⁻¹/g;

/**
 * Number words let a sum through without a digit. These Thai words contain one by accident, and each is
 * common enough in a tutor's sentence to be worth telling apart. A rare miss only means falling back.
 */
const NUMBER_WORDS =
  /(?<!นิด|ครู่|อย่าง|ส่วน|ครั้ง)หนึ่ง|(?<!นิด|ครู่)นึง|สอง|สาม(?!ารถ|เหลี่ยม)|สี่(?!เหลี่ยม)|(?<!ก)ห้า(?!ม)|หก(?!ล้ม)|เจ็ด|แปด|เก้า|สิบ|(?<!เรียบ)ร้อย|(?<!สัม)พัน(?!ธ)|ศูนย์/;

/** Words that turn what follows into an amount: how many are left, wrong, missing, or what it equals. */
const COUNTING = String.raw`(?<!(?:อีก|เหลือ|แค่|ขาด|ผิด|มี|ได้|เป็น|คือ|เพียง|เท่ากับ|เท่า|เฉพาะ|แต่|ไป|อยู่|หมด|ต้อง|แก้|ทั้ง)\s*)`;

/**
 * Maths names that hold a number word but never an amount (AI_DIRECTOR §4.3), matched whole and taken
 * out before the number-word check unless a counting word stands right before one. Two adversarial
 * reviews on 25 Nov 2026 broke longer lists: counted things (two vectors, both cells, the two diagonals)
 * can always say how many are left or wrong, so none of them is here.
 */
const NAMED_TERMS = new RegExp(COUNTING + '(?:เวกเตอร์หนึ่งหน่วย|รากที่สอง|สองมิติ|สามมิติ)', 'g');

/**
 * Squared is a name only where no answer is a power: on vector items it is how a length is found. On a
 * matrix item "k ต้องยกกำลังสอง" gives the exponent of det(kA), so it stays a number there.
 */
const SQUARED = new RegExp(
  COUNTING + String.raw`(?:(?<![A-Za-z0-9)}\]]\s*)ยกกำลังสอง|(?<!ยก|[A-Za-z0-9)}\]]\s*)กำลังสอง)`,
  'g',
);

export interface NumberCheck {
  /** True on vector items, where squared names an operation. */
  squaredIsName?: boolean;
}

function withoutNames(text: string, { squaredIsName = false }: NumberCheck): string {
  const named = text.replace(NAMED_TERMS, ' ');
  return squaredIsName ? named.replace(SQUARED, ' ') : named;
}

export function hasNumberInWords(text: string, check: NumberCheck = {}): boolean {
  return NUMBER_WORDS.test(withoutNames(text, check));
}

export function hasNumber(text: string, check: NumberCheck = {}): boolean {
  const plain = text.replace(INVERSE, '$1');
  return DIGITS.test(plain) || hasNumberInWords(plain, check);
}

/**
 * A token is a number once it is filled in, so it can never name the matrix: "อินเวอร์สของ {{aCell}}"
 * reads "the inverse of 5". Claude Sonnet 5.5 wrote this in about one message in fifteen in the eval
 * of 25 Nov 2026. Sizes such as {{dimsA}} and whole answers can follow these words, so they are not here.
 */
const TOKEN_AS_NAME =
  /(?:เมทริกซ์|อินเวอร์สของ|det\s*ของ|ดีเทอร์มิแนนต์ของ)\s*\{\{(?:aCell|bCell|studentCell|correctCell|k|det|i|j)\}\}/;

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
  /** The item's topic: on vectors, squared names an operation (hasNumber). */
  topic?: string;
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
  topic,
}: ValidateInput): Validated {
  const numberCheck = { squaredIsName: topic === 'vector' };
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
    !TOKEN_AS_NAME.test(line) &&
    tokensIn(line).every((token) => {
      const name = token as TokenName;
      return allowedTokens.includes(name) && (revealAllowed || !REVEALING_TOKENS.includes(name));
    });

  const message = sizesToTokens(decision.message, sizes);
  if (hasNumber(message, numberCheck)) return { ok: false, reason: 'digit_violation' };
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
        !hasNumber(text, numberCheck) &&
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
