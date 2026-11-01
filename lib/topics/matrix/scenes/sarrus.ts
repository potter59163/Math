import { th } from '@/lib/content/th';
import type { Rational } from '@/lib/core/rational';
import type { Answer, Matrix } from '@/lib/core/types';
import { factorText as f, rationalText } from '../format';
import { det, minor, sarrusLines, sum } from '../ops';
import type { SarrusBeat, SarrusParams, SarrusVariant, ScenePurpose, SceneSpecOf } from './types';

const BEAT_MS: Record<SarrusBeat, number> = {
  copy: 2000,
  compare: 3000,
  down: 3000,
  up: 3000,
  result: 3000,
};

/** The products along each line: one line each way on a 2×2, three on a 3×3 (Sarrus). */
function linesOf(A: Matrix): { down: Rational[]; up: Rational[] } {
  if (A.length === 3) return sarrusLines(A);
  const [[a, b], [c, d]] = A;
  return { down: [a.mul(d)], up: [b.mul(c)] };
}

/** What each wrong formula of M12 and M13 computes here, written out the way it was worked. */
function wrongWork(
  variant: SarrusVariant,
  A: Matrix,
  down: Rational[],
  up: Rational[],
): NonNullable<SarrusParams['wrong']> {
  const answer = (expression: string, value: Rational) => ({
    variant,
    value,
    expression: `${expression} = ${rationalText(value)}`,
  });
  const [a, b] = A[0];
  const [c, d] = A[1];
  switch (variant) {
    case 'ALL_PLUS': {
      const [first, ...rest] = [...down, ...up];
      const tail = rest.map((term) => ` + ${f(term)}`).join('');
      return answer(`${rationalText(first)}${tail}`, sum([...down, ...up]));
    }
    case 'NO_ALT_SIGN': {
      const terms = A[0].map((cell, column) => [cell, minor(A, 1, column + 1)]);
      return answer(
        terms.map(([cell, part]) => `${f(cell)}·${f(part)}`).join(' + '),
        sum(terms.map(([cell, part]) => cell.mul(part))),
      );
    }
    case 'TWO_DIAG':
      return answer(`${rationalText(down[0])} − ${f(up[0])}`, down[0].sub(up[0]));
    case 'ADD':
      return answer(`${f(a)}·${f(d)} + ${f(b)}·${f(c)}`, a.mul(d).add(b.mul(c)));
    case 'REVERSE':
      return answer(`${f(b)}·${f(c)} − ${f(a)}·${f(d)}`, b.mul(c).sub(a.mul(d)));
    case 'PAIRS_ROW':
      return answer(`${f(a)}·${f(b)} − ${f(c)}·${f(d)}`, a.mul(b).sub(c.mul(d)));
    case 'PAIRS_COL':
      return answer(`${f(a)}·${f(c)} − ${f(b)}·${f(d)}`, a.mul(c).sub(b.mul(d)));
  }
}

export interface SarrusInput {
  A: Matrix;
  variant?: SarrusVariant;
  studentAnswer?: Answer;
  purpose: ScenePurpose;
}

/** SCENES §4. Lines going down add and lines going up subtract, on a 2×2 or a 3×3. */
export function sarrusScene({
  A,
  variant,
  studentAnswer,
  purpose,
}: SarrusInput): SceneSpecOf<'sarrus'> {
  const copy = th.scenes.sarrus;
  const size = A.length === 3 ? 3 : 2;
  const { down, up } = linesOf(A);
  const isBig = size === 3;
  const beats: SarrusBeat[] = [
    ...(isBig ? (['copy'] as const) : []),
    ...(variant ? (['compare'] as const) : []),
    'down',
    'up',
    'result',
  ];
  return {
    template: 'sarrus',
    params: {
      A,
      size,
      down,
      up,
      downSum: sum(down),
      upSum: sum(up),
      det: det(A),
      ...(variant && { wrong: wrongWork(variant, A, down, up) }),
    },
    beats,
    captions: {
      ...(isBig && { copy: copy.copy }),
      ...(variant && { compare: copy.compare[variant] }),
      down: isBig ? copy.down3 : copy.down2,
      up: isBig ? copy.up3 : copy.up2,
      result: copy.result,
    },
    beatMs: BEAT_MS,
    ...(studentAnswer && { compare: { studentAnswer, variant } }),
    purpose,
  };
}
