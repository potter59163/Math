import { tokensIn } from '@/lib/core/tokens';
import type { Candidate, FallbackReason } from '@/lib/director/types';
import { REVEALING_TOKENS, type TokenName, type TokenValues } from '@/lib/director/tokens';
import { LlmDecision, MAX_NARRATION_LINES, MAX_NARRATION_UNITS, MAX_REASON_UNITS } from './schema';

// AI_DIRECTOR §4.3. A choice or message that fails here is thrown away and the rules decide instead.

/** Arabic and Thai digits, and the superscripts that could say "k²" without a digit. */
const DIGITS = /[0-9๐-๙⁰¹²³⁴-⁹₀-₉]/;

/** The inverse of a named matrix, A⁻¹ or (AB)⁻¹: a name, never a number. */
const INVERSE = /([A-Za-z)])⁻¹/g;

/**
 * Number words let a sum through without a digit. These Thai words contain one by accident, and each is
 * common enough in a tutor's sentence to be worth telling apart. A rare miss only means falling back.
 * The vector topic's own words (squared, square root, 2D and 3D, unit vector, two or three vectors, two
 * points) and det's two diagonals name a kind of thing, never an answer, and the eval of 25 Nov 2026
 * threw away about one vector message in five over them. So do the item's own things counted by name
 * (the two vectors, these two, one step, one cell). A bare count such as อีกสองช่อง still fails: it can
 * say how much is left to do.
 */
const NUMBER_WORDS =
  /(?<!นิด|ครู่|อย่าง|ส่วน|ครั้ง|ช่อง|ขั้น|ด่าน)หนึ่ง(?!หน่วย)|(?<!กำลัง|รากที่|เวกเตอร์)สอง(?!มิติ|เวกเตอร์|จุด|เส้นทแยง|แนวทแยง|ตัวนี้)|สาม(?!ารถ|เหลี่ยม|มิติ|เวกเตอร์)|สี่(?!เหลี่ยม)|(?<!ก)ห้า(?!ม)|หก(?!ล้ม)|เจ็ด|แปด|เก้า|สิบ|(?<!เรียบ)ร้อย|(?<!สัม)พัน(?!ธ)|ศูนย์/;

export function hasNumberInWords(text: string): boolean {
  return NUMBER_WORDS.test(text);
}

export function hasNumber(text: string): boolean {
  const plain = text.replace(INVERSE, '$1');
  return DIGITS.test(plain) || hasNumberInWords(plain);
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
    !TOKEN_AS_NAME.test(line) &&
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
