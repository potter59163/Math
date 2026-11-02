import { th } from '@/lib/content/th';
import { fillTokens } from '@/lib/core/tokens';
import type { Answer, Matrix } from '@/lib/core/types';
import { subscript } from '../format';
import type { CellBeat, ScenePurpose, SceneSpecOf } from './types';
import { timedBeats, type VoiceId } from './voice';

const BEAT_MS: Record<CellBeat, number> = {
  compare: 3000,
  row: 1800,
  col: 1800,
  hit: 2000,
  try: 1000,
  try_done: 2000,
};

const VOICE: Partial<Record<CellBeat, VoiceId>> = {
  compare: 'cell.compare',
  row: 'cell.row',
  col: 'cell.col',
  hit: 'cell.hit',
  try: 'cell.try',
  try_done: 'cell.try_done',
};

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
    beats: swapped ? ['compare', 'row', 'col', 'hit', 'try', 'try_done'] : ['row', 'col', 'hit'],
    captions: {
      row: fillTokens(copy.row, { i: String(i) }),
      col: fillTokens(copy.col, { j: String(j) }),
      hit: fillTokens(copy.hit, { name }),
      ...(swapped && {
        compare: fillTokens(copy.compare, { name: swapped.name }),
        try: fillTokens(copy.try, { name: swapped.name }),
        try_done: copy.try_done,
      }),
    },
    beatMs: timedBeats(BEAT_MS, VOICE),
    voice: VOICE,
    ...(swapped && {
      waits: ['try'] as CellBeat[],
      hints: { try: { caption: copy.hint, voice: 'cell.hint' as const } },
    }),
    ...(studentAnswer && { compare: { studentAnswer } }),
    purpose,
  };
}
