import { th } from '@/lib/content/th';
import { fillTokens } from '@/lib/core/tokens';
import type { Answer, Dims, Matrix } from '@/lib/core/types';
import { dimsLabel } from '../format';
import { sameDims } from '../ops';
import type {
  DimensionBeat,
  DimensionMatchParams,
  DimensionOp,
  ScenePurpose,
  SceneSpecOf,
} from './types';

const BEAT_MS: Record<DimensionBeat, number> = {
  blocks: 2000,
  count_rows: 2000,
  count_cols: 2000,
  check: 2500,
  result: 2500,
};

export interface DimensionInput {
  op: DimensionOp;
  first: Dims;
  second?: Dims;
  names?: DimensionMatchParams['names'];
  values?: Matrix;
  labels?: DimensionMatchParams['labels'];
  student?: DimensionMatchParams['student'];
  studentAnswer?: Answer;
  variant?: string;
  purpose: ScenePurpose;
  captions?: Partial<Record<DimensionBeat, string>>;
}

function outcome(
  op: DimensionOp,
  first: Dims,
  second?: Dims,
): Pick<DimensionMatchParams, 'fits' | 'result'> {
  if (op === 'single' || !second) return { fits: true, result: first };
  if (op === 'add') {
    const fits = sameDims(first, second);
    return { fits, result: fits ? first : null };
  }
  const fits = first.cols === second.rows;
  return { fits, result: fits ? { rows: first.rows, cols: second.cols } : null };
}

/** SCENES §3.2. Numbers come from the item's own dims; `result` is null when it cannot be computed. */
export function dimensionScene({
  op,
  first,
  second,
  names = { first: 'A', second: 'B' },
  values,
  labels,
  student,
  studentAnswer,
  variant,
  purpose,
  captions,
}: DimensionInput): SceneSpecOf<'dimension_match'> {
  const copy = th.scenes.dimension;
  const { fits, result } = outcome(op, first, second);
  const beats: DimensionBeat[] =
    op === 'single'
      ? ['blocks', 'count_rows', 'count_cols', 'result']
      : ['blocks', 'check', 'result'];

  const pairBlocks = second
    ? fillTokens(copy.pair_blocks, {
        first: names.first,
        second: names.second ?? '',
        dimsFirst: dimsLabel(first),
        dimsSecond: dimsLabel(second),
      })
    : '';
  const byOp = {
    single: {
      blocks: copy.single_blocks,
      count_rows: fillTokens(copy.count_rows, { rows: String(first.rows) }),
      count_cols: fillTokens(copy.count_cols, { cols: String(first.cols) }),
      result: copy.single_result,
    },
    add: {
      blocks: pairBlocks,
      check: copy.add_check,
      result: fits ? copy.add_ok : copy.add_no,
    },
    mult: {
      blocks: pairBlocks,
      check: copy.mult_check,
      result: fits ? copy.mult_ok : copy.mult_no,
    },
  } satisfies Record<DimensionOp, Partial<Record<DimensionBeat, string>>>;

  return {
    template: 'dimension_match',
    params: {
      op,
      first,
      ...(second && { second }),
      names,
      ...(values && { values }),
      ...(labels && { labels }),
      fits,
      result,
      ...(student && { student }),
    },
    beats,
    captions: { ...byOp[op], ...captions },
    beatMs: BEAT_MS,
    ...(studentAnswer && { compare: { studentAnswer, variant } }),
    purpose,
  };
}
