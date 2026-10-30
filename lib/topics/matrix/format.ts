import type { Dims, Matrix } from '@/lib/core/types';
import type { MatrixData } from './types';

/** The matrices an item shows the student, in reading order. Other forms state theirs in words. */
export function givenMatrices(data: MatrixData): { label: string; value: Matrix }[] {
  switch (data.form) {
    case 'addsub':
    case 'combo':
    case 'mult':
    case 'noncomm_pair':
    case 'det_sum':
      return [
        { label: 'A', value: data.A },
        { label: 'B', value: data.B },
      ];
    case 'noncomm_find_ba':
      return [
        { label: 'A', value: data.A },
        { label: 'B', value: data.B },
        { label: 'AB', value: data.AB },
      ];
    case 'dim':
    case 'index':
    case 'transpose':
    case 'scalar':
    case 'det2':
    case 'det3':
    case 'invertible':
    case 'inv2':
      return [{ label: 'A', value: data.A }];
    default:
      return [];
  }
}

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
