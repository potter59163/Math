import { th } from '@/lib/content/th';
import { fillTokens } from '@/lib/core/tokens';
import type { Answer, Dims, Matrix } from '@/lib/core/types';
import { dimsLabel } from '../format';
import { sameDims, transpose } from '../ops';
import { choiceOf } from './tryChoice';
import type {
  ClipHint,
  DimensionBeat,
  DimensionMatchParams,
  DimensionOp,
  DimensionTry,
  ScenePurpose,
  SceneSpecOf,
} from './types';
import { timedBeats, type VoiceId } from './voice';

const BEAT_MS: Record<DimensionBeat, number> = {
  compare: 3000,
  blocks: 2000,
  count_rows: 2200,
  count_cols: 2200,
  check: 2500,
  result: 2500,
  try: 1000,
  try_done: 2000,
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

const flipped = ({ rows, cols }: Dims): Dims => ({ rows: cols, cols: rows });

type TryKind = keyof typeof th.scenes.dimension.try;

/** Asks about another shape than the one just explained, so that the answer is not on the screen. */
function tryFor(
  op: DimensionOp,
  first: Dims,
  second: Dims | undefined,
  names: DimensionMatchParams['names'],
  variant: string | undefined,
  values: Matrix | undefined,
): { kind: TryKind; question: DimensionTry } | undefined {
  const { can, cannot } = th.scenes.dimension;
  const salt = first.rows + first.cols;
  const yesOrNo = (yes: boolean) => choiceOf(yes ? can : cannot, [yes ? cannot : can], salt);
  if (op === 'single') {
    const shape = flipped(first);
    if (sameDims(first, shape)) return undefined;
    return {
      kind: 'single',
      question: {
        first: shape,
        ...(values && { values: transpose(values) }),
        ...choiceOf(dimsLabel(shape), [dimsLabel(first)], salt),
      },
    };
  }
  if (!second) return undefined;
  if (op === 'add') {
    const shape = flipped(first);
    return {
      kind: 'add',
      question: {
        first,
        second: shape,
        names: { first: names.first, second: 'C' },
        ...yesOrNo(sameDims(first, shape)),
      },
    };
  }
  // A mult_defined item asked about the dims of the product only when it can be worked out.
  const swappedPair: DimensionTry = {
    first: second,
    second: first,
    names: { first: names.second ?? '', second: names.first },
    ...yesOrNo(second.cols === first.rows),
  };
  const isAboutFit = variant === 'SAME_DIMS' || variant === 'RESULT_OUTER';
  if (isAboutFit || first.cols !== second.rows) return { kind: 'can', question: swappedPair };
  const [nextFirst, nextSecond] = [flipped(second), flipped(first)];
  const right = dimsLabel({ rows: nextFirst.rows, cols: nextSecond.cols });
  const inner = dimsLabel({ rows: nextFirst.cols, cols: nextFirst.cols });
  if (right === inner) return { kind: 'can', question: swappedPair };
  return {
    kind: 'dims',
    question: {
      first: nextFirst,
      second: nextSecond,
      names: { first: 'C', second: 'D' },
      ...choiceOf(right, [inner], salt),
    },
  };
}

const HINT_VOICE: Record<TryKind, VoiceId> = {
  single: 'table.hint',
  add: 'fit.hint_add',
  can: 'fit.hint_can',
  dims: 'fit.hint_dims',
};

const TRY_VOICE: Record<TryKind, VoiceId> = {
  single: 'table.try',
  add: 'fit.try_add',
  can: 'fit.try_can',
  dims: 'fit.try_dims',
};

function studentText(student: DimensionMatchParams['student']): string {
  if (!student) return '';
  return student === 'undefined' ? th.scenes.player.undefined : dimsLabel(student);
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
  const correcting = purpose === 'remediate';
  const asked = correcting ? tryFor(op, first, second, names, variant, values) : undefined;
  const closing = asked ? (['try', 'try_done'] as const) : [];
  const beats: DimensionBeat[] =
    op === 'single'
      ? correcting
        ? ['compare', 'count_rows', 'count_cols', 'result', ...closing]
        : ['blocks', 'count_rows', 'count_cols', 'result']
      : correcting
        ? ['compare', 'check', 'result', ...closing]
        : ['blocks', 'check', 'result'];

  const pairBlocks = second
    ? fillTokens(copy.pair_blocks, {
        first: names.first,
        second: names.second ?? '',
        dimsFirst: dimsLabel(first),
        dimsSecond: dimsLabel(second),
      })
    : '';
  const compareKey = (
    op === 'add' ? 'ADD' : (variant ?? 'RESULT_OUTER')
  ) as keyof typeof copy.compare;
  const byOp = {
    single: {
      compare: fillTokens(copy.compare_single, { student: studentText(student) }),
      blocks: copy.single_blocks,
      count_rows: fillTokens(copy.count_rows, { rows: String(first.rows) }),
      count_cols: fillTokens(copy.count_cols, { cols: String(first.cols) }),
      result: copy.single_result,
      try_done: copy.done.single,
    },
    add: {
      compare: copy.compare[compareKey],
      blocks: pairBlocks,
      check: copy.add_check,
      result: fits ? copy.add_ok : copy.add_no,
      try_done: copy.done.add,
    },
    mult: {
      compare: copy.compare[compareKey],
      blocks: pairBlocks,
      check: copy.mult_check,
      result: fits ? copy.mult_ok : copy.mult_no,
      try_done: copy.done.mult,
    },
  } satisfies Record<DimensionOp, Partial<Record<DimensionBeat, string>>>;

  const voiceByOp: Record<DimensionOp, Partial<Record<DimensionBeat, VoiceId>>> = {
    single: {
      compare: 'table.compare',
      blocks: purpose === 'intro' ? 'table.intro_blocks' : 'table.blocks',
      count_rows: 'table.count_rows',
      count_cols: 'table.count_cols',
      result: purpose === 'intro' ? 'table.intro_result' : 'table.result',
      try_done: 'table.try_done',
    },
    add: {
      compare: 'fit.compare_add',
      blocks: 'fit.blocks',
      check: 'fit.add_check',
      result: fits ? 'fit.add_ok' : 'fit.add_no',
      try_done: 'fit.done_add',
    },
    mult: {
      compare: `fit.compare_${compareKey as Exclude<typeof compareKey, 'ADD'>}`,
      blocks: 'fit.blocks',
      check: 'fit.mult_check',
      result: fits ? 'fit.mult_ok' : 'fit.mult_no',
      try_done: 'fit.done_mult',
    },
  };
  const voice = { ...voiceByOp[op], ...(asked && { try: TRY_VOICE[asked.kind] }) };
  const hint: ClipHint | undefined = asked && {
    caption: copy.hint[asked.kind],
    voice: HINT_VOICE[asked.kind],
  };

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
      ...(asked && { try: asked.question }),
    },
    beats,
    captions: {
      ...byOp[op],
      ...(asked && { try: copy.try[asked.kind] }),
      ...captions,
    },
    beatMs: timedBeats(BEAT_MS, voice),
    voice,
    ...(asked && { waits: ['try'] as DimensionBeat[], hints: { try: hint } }),
    ...(studentAnswer && { compare: { studentAnswer, variant } }),
    purpose,
  };
}
