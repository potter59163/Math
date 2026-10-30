import type { Dims } from '@/lib/core/types';

export function dimsLabel({ rows, cols }: Dims): string {
  return `${rows}×${cols}`;
}

/** Number for Thai copy, with a typographic minus. */
export function signed(value: number): string {
  return String(value).replace('-', '−');
}

const SUBSCRIPT_DIGITS = '₀₁₂₃₄₅₆₇₈₉';

export function subscript(value: number): string {
  return [...String(value)].map((digit) => SUBSCRIPT_DIGITS[Number(digit)]).join('');
}
