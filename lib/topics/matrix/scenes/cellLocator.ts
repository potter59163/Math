import { th } from '@/lib/content/th';
import { fillTokens } from '@/lib/core/tokens';
import type { Answer, Matrix } from '@/lib/core/types';
import { subscript } from '../format';
import type { CellBeat, ScenePurpose, SceneSpecOf } from './types';

const BEAT_MS: Record<CellBeat, number> = { row: 1500, col: 1500, hit: 2000, compare: 3000 };

const nameOf = (i: number, j: number) => `a${subscript(i)}${subscript(j)}`;

export interface CellLocatorInput {
  A: Matrix;
  /** 1-based, as the item asks for aᵢⱼ. */
  i: number;
  j: number;
  /** M02: also points at aⱼᵢ, the cell the student read. */
  showSwapped?: boolean;
  studentAnswer?: Answer;
  purpose: ScenePurpose;
}

/** SCENES §4. Which row, then which column, then where they cross. */
export function cellLocatorScene({
  A,
  i,
  j,
  showSwapped = false,
  studentAnswer,
  purpose,
}: CellLocatorInput): SceneSpecOf<'cell_locator'> {
  const copy = th.scenes.cell;
  const name = nameOf(i, j);
  const swapped = showSwapped ? { name: nameOf(j, i), value: A[j - 1][i - 1] } : undefined;
  return {
    template: 'cell_locator',
    params: { A, i, j, name, value: A[i - 1][j - 1], ...(swapped && { swapped }) },
    beats: ['row', 'col', 'hit', ...(swapped ? (['compare'] as const) : [])],
    captions: {
      row: fillTokens(copy.row, { i: String(i) }),
      col: fillTokens(copy.col, { j: String(j) }),
      hit: fillTokens(copy.hit, { name }),
      ...(swapped && { compare: fillTokens(copy.compare, { name: swapped.name }) }),
    },
    beatMs: BEAT_MS,
    ...(studentAnswer && { compare: { studentAnswer } }),
    purpose,
  };
}
