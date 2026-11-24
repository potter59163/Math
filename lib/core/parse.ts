import { Rational } from './rational';
import { Surd } from './surd';
import type { Answer, ItemKind, Matrix } from './types';

export type ParseFailure = 'empty' | 'invalid' | 'zero_denominator' | 'too_large' | 'wrong_kind';

export type ParseResult<T> =
  | { ok: true; value: T }
  /** `cell` is the 1-based matrix cell that failed. */
  | { ok: false; reason: ParseFailure; cell?: [number, number] };

/** What the input UI holds before parsing. */
export type RawAnswer =
  | { type: 'matrix'; cells: string[][] }
  | { type: 'number'; text: string }
  /** One text per component, for `vector` items. */
  | { type: 'vector'; cells: string[] }
  | { type: 'dims'; rows: string; cols: string }
  | { type: 'choice'; id: string }
  | { type: 'undefined' };

const THAI_DIGITS = '๐๑๒๓๔๕๖๗๘๙';
/** Longer digit runs do not fit a double exactly, and could not fit a Rational anyway. */
const MAX_DIGITS = 15;

function normalize(raw: string): string {
  return raw
    .replace(/[๐-๙]/g, (digit) => String(THAI_DIGITS.indexOf(digit)))
    .replace(/[−–]/g, '-')
    .trim();
}

function fail(reason: ParseFailure): { ok: false; reason: ParseFailure } {
  return { ok: false, reason };
}

function fraction(numerator: string, denominator: string): ParseResult<Rational> {
  if (numerator.replace('-', '').length > MAX_DIGITS) return fail('too_large');
  if (denominator.replace('-', '').length > MAX_DIGITS) return fail('too_large');
  if (Number(denominator) === 0) return fail('zero_denominator');
  try {
    return { ok: true, value: Rational.of(Number(numerator), Number(denominator)) };
  } catch {
    return fail('too_large');
  }
}

/** One typed number, with the rules of SPEC §5. Never throws on student input. */
export function parseNumber(raw: string): ParseResult<Rational> {
  const normalized = normalize(raw);
  if (normalized === '') return fail('empty');
  // Stripping spaces would turn the mixed number "1 1/2" into 11/2, a different number.
  if (/[\d.]\s+[\d.]/.test(normalized)) return fail('invalid');
  const text = normalized.replace(/\s+/g, '');

  const asFraction = /^(-?\d+)\/(-?\d+)$/.exec(text);
  if (asFraction) return fraction(asFraction[1], asFraction[2]);

  if (/^-?\d+$/.test(text)) return fraction(text, '1');

  const asDecimal = /^(-?)(\d*)\.(\d+)$/.exec(text);
  if (asDecimal) {
    const [, sign, whole, decimals] = asDecimal;
    if (decimals.length > MAX_DIGITS) return fail('too_large');
    return fraction(`${sign}${whole}${decimals}`, String(10 ** decimals.length));
  }

  return fail('invalid');
}

function surdOf(
  sign: string,
  coeff: ParseResult<Rational>,
  radicand: string,
  divisor = '1',
): ParseResult<Surd> {
  if (!coeff.ok) return coeff;
  if (radicand.length > MAX_DIGITS || divisor.length > MAX_DIGITS) return fail('too_large');
  if (Number(radicand) === 0) return fail('invalid');
  if (Number(divisor) === 0) return fail('zero_denominator');
  try {
    const value = Surd.of(coeff.value, Number(radicand)).div(Number(divisor));
    return { ok: true, value: sign === '-' ? value.neg() : value };
  } catch {
    return fail('too_large');
  }
}

/**
 * A typed number that may hold one √ (docs/VECTORS.md §3.3). Any rational parseNumber takes, and
 * `3√2`, `-√3/2`, `3√2/2`, `3/2√2` (read as (3/2)√2) and `1/√2`. Unsimplified forms such as √8 are
 * fine: the value is what counts, as 2/4 counts for 1/2.
 */
export function parseSurd(raw: string): ParseResult<Surd> {
  const normalized = normalize(raw);
  if (normalized === '') return fail('empty');
  if (!normalized.includes('√')) {
    const parsed = parseNumber(normalized);
    return parsed.ok ? { ok: true, value: Surd.rational(parsed.value) } : parsed;
  }
  if (/\s/.test(normalized)) return fail('invalid');

  const timesRoot = /^(-?)(\d+)?√(\d+)(?:\/(\d+))?$/.exec(normalized);
  if (timesRoot) {
    const [, sign, coeff, radicand, divisor] = timesRoot;
    return surdOf(sign, fraction(coeff ?? '1', '1'), radicand, divisor);
  }
  const fractionTimesRoot = /^(-?)(\d+)\/(\d+)√(\d+)$/.exec(normalized);
  if (fractionTimesRoot) {
    const [, sign, numerator, denominator, radicand] = fractionTimesRoot;
    return surdOf(sign, fraction(numerator, denominator), radicand);
  }
  const overRoot = /^(-?)(\d+)\/√(\d+)$/.exec(normalized);
  if (overRoot) {
    const [, sign, numerator, radicand] = overRoot;
    const root = surdOf('', fraction('1', '1'), radicand);
    if (!root.ok) return root;
    const top = fraction(numerator, '1');
    if (!top.ok) return top;
    const value = Surd.rational(top.value).div(root.value);
    return { ok: true, value: sign === '-' ? value.neg() : value };
  }
  return fail('invalid');
}

function parseMatrix(cells: string[][]): ParseResult<Answer> {
  const cols = cells[0]?.length ?? 0;
  if (cols === 0 || cells.some((row) => row.length !== cols)) return fail('invalid');

  const value: Matrix = [];
  for (let i = 0; i < cells.length; i += 1) {
    const row: Rational[] = [];
    for (let j = 0; j < cols; j += 1) {
      const parsed = parseNumber(cells[i][j]);
      if (!parsed.ok) return { ok: false, reason: parsed.reason, cell: [i + 1, j + 1] };
      row.push(parsed.value);
    }
    value.push(row);
  }
  return { ok: true, value: { kind: 'matrix', value } };
}

function parseDimension(raw: string): ParseResult<number> {
  const text = normalize(raw);
  if (text === '') return fail('empty');
  if (!/^\d{1,3}$/.test(text) || Number(text) === 0) return fail('invalid');
  return { ok: true, value: Number(text) };
}

/** Turns raw input into an Answer for an item of this kind. */
export function parseAnswer(kind: ItemKind, raw: RawAnswer): ParseResult<Answer> {
  if (raw.type === 'undefined') {
    return kind === 'matrix_or_undefined' || kind === 'dims_or_undefined'
      ? { ok: true, value: { kind: 'undefined' } }
      : fail('wrong_kind');
  }

  switch (kind) {
    case 'matrix':
    case 'matrix_or_undefined':
      return raw.type === 'matrix' ? parseMatrix(raw.cells) : fail('wrong_kind');
    case 'scalar':
    case 'cell': {
      if (raw.type !== 'number') return fail('wrong_kind');
      const parsed = parseNumber(raw.text);
      return parsed.ok ? { ok: true, value: { kind: 'scalar', value: parsed.value } } : parsed;
    }
    case 'dims':
    case 'dims_or_undefined': {
      if (raw.type !== 'dims') return fail('wrong_kind');
      const rows = parseDimension(raw.rows);
      if (!rows.ok) return rows;
      const cols = parseDimension(raw.cols);
      if (!cols.ok) return cols;
      return { ok: true, value: { kind: 'dims', rows: rows.value, cols: cols.value } };
    }
    case 'choice':
      return raw.type === 'choice'
        ? { ok: true, value: { kind: 'choice', id: raw.id } }
        : fail('wrong_kind');
    case 'surd': {
      if (raw.type !== 'number') return fail('wrong_kind');
      const parsed = parseSurd(raw.text);
      return parsed.ok ? { ok: true, value: { kind: 'surd', value: parsed.value } } : parsed;
    }
    case 'vector': {
      if (raw.type !== 'vector' || raw.cells.length === 0) return fail('wrong_kind');
      const value: Surd[] = [];
      for (let i = 0; i < raw.cells.length; i += 1) {
        const parsed = parseSurd(raw.cells[i]);
        if (!parsed.ok) return { ok: false, reason: parsed.reason, cell: [i + 1, 1] };
        value.push(parsed.value);
      }
      return { ok: true, value: { kind: 'vector', value } };
    }
  }
}
