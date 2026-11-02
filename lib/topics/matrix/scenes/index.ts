import { CONFIG } from '@/lib/config';
import { th } from '@/lib/content/th';
import { answersEqual, countDiffCells } from '@/lib/core/classify';
import { createRng, deriveSeed } from '@/lib/core/prng';
import { Rational } from '@/lib/core/rational';
import { fillTokens } from '@/lib/core/tokens';
import type { Answer, Level, Matrix } from '@/lib/core/types';
import { generate } from '../generators';
import { sceneFor, type SceneRef } from '../misconceptions';
import { equals, matrix, mul, sarrusLines, shape, transpose } from '../ops';
import type { Skill, SkillId } from '../skills';
import type { MatrixItem, MisconceptionId } from '../types';
import type { ThemeId } from '@/lib/learner/types';
import { cellByCellScene } from './cellByCell';
import { cellLocatorScene } from './cellLocator';
import { detSumScene } from './detSum';
import { dimensionScene } from './dimensionMatch';
import { gridScene, type GridMistake } from './gridTransform';
import { inverseScene } from './inverseRecipe';
import { billOf, rowColDotScene } from './rowColDot';
import { sarrusScene } from './sarrus';
import { DOCUMENTED_NUMBERS, introNumbers } from './stories';
import { transposeScene } from './transposeFlip';
import type {
  AnyScene,
  CellIndex,
  InverseVariant,
  RowColVariant,
  SarrusVariant,
  ScenePurpose,
  SceneSpec,
  TransposeVariant,
} from './types';
import { workedScene } from './workedSolution';

export type { SceneSpec, ScenePurpose, TemplateId } from './types';

/** A beat that waits for the student's tap takes as long as they take, so it does not count. */
export function sceneDurationMs(spec: AnyScene | SceneSpec): number {
  const { beats, beatMs, waits } = spec as AnyScene;
  return beats.reduce(
    (total, beat) => total + (waits?.includes(beat) ? 0 : (beatMs[beat] ?? 0)),
    0,
  );
}

export function sceneLimitMs(purpose: ScenePurpose): number {
  return CONFIG.scenes.limitMs[purpose];
}

/**
 * Seed for a scene's example. It never touches `Profile.counter`, so how many clips a student opens
 * cannot move the numbers of their real items (SPEC §6).
 */
export function exampleSeed(base: number | string, nth: number): number {
  return deriveSeed(`example:${base}`, nth);
}

/** The cell a scene focuses on. Director tokens use it too, so words and picture name the same cell. */
export function firstWrongCell(answer: Answer, correct: Answer): CellIndex {
  if (answer.kind !== 'matrix' || correct.kind !== 'matrix') return [1, 1];
  if (countDiffCells(answer.value, correct.value) === null) return [1, 1];
  for (let i = 0; i < answer.value.length; i += 1) {
    for (let j = 0; j < answer.value[i].length; j += 1) {
      if (!answer.value[i][j].equals(correct.value[i][j])) return [i + 1, j + 1];
    }
  }
  return [1, 1];
}

/**
 * A small 2×2 whose det is exactly d: [[±p, 1], [0, q]] with p·q = |d|, as near square as d allows.
 * det_scaled items state det(A) but show no matrix, so this draws what that number means.
 */
export function matrixWithDet(d: number): Matrix {
  if (!Number.isInteger(d) || d === 0) throw new Error(`matrixWithDet: bad det ${d}`);
  const size = Math.abs(d);
  let q = Math.floor(Math.sqrt(size));
  while (size % q !== 0) q -= 1;
  const p = size / q;
  return matrix([
    [d < 0 ? -p : p, 1],
    [0, q],
  ]);
}

// Simple transforms that stay readable on a small grid. Pairs from the mult_noncomm generator reach
// products near 72, which leaves the unit square a couple of pixels wide.
const TRANSFORMS: Matrix[] = [
  matrix([
    [0, -1],
    [1, 0],
  ]),
  matrix([
    [2, 0],
    [0, 1],
  ]),
  matrix([
    [1, 0],
    [0, 2],
  ]),
  matrix([
    [1, 1],
    [0, 1],
  ]),
  matrix([
    [1, 0],
    [1, 1],
  ]),
  matrix([
    [0, 1],
    [1, 0],
  ]),
];

const NON_COMMUTING_PAIRS: { M: Matrix; N: Matrix }[] = TRANSFORMS.flatMap((M) =>
  TRANSFORMS.filter((N) => !equals(mul(M, N), mul(N, M))).map((N) => ({ M, N })),
);

/** The matrices a compose example must not show: the ones in the open item and its answer. */
function matricesOf(item: MatrixItem | undefined): Matrix[] {
  if (!item) return [];
  const { data, correct } = item;
  const shown = 'A' in data && 'B' in data ? [data.A, data.B] : [];
  return correct.kind === 'matrix' ? [...shown, correct.value] : shown;
}

function composePair(seed: number, avoid?: MatrixItem): { M: Matrix; N: Matrix } {
  const forbidden = matricesOf(avoid);
  const clean = NON_COMMUTING_PAIRS.filter(({ M, N }) =>
    [M, N, mul(M, N), mul(N, M)].every((value) => !forbidden.some((other) => equals(value, other))),
  );
  return createRng(seed).pick(clean);
}

const MAX_EXAMPLE_TRIES = 50;

/** Teaches the concept without showing this item, its numbers or its answer (SPEC §4). */
function givesAway(example: MatrixItem, open: MatrixItem | undefined): boolean {
  if (!open) return false;
  if (JSON.stringify(example.data) === JSON.stringify(open.data)) return true;
  return open.kind !== 'choice' && answersEqual(example.correct, open.correct);
}

const MIN_LIVE_SARRUS_LINES = 3;

/**
 * An example that cannot show what its scene is about, such as a row of zeros for pairing a row with
 * a column. These are fair items, since a student can still work them, but they teach nothing.
 */
function cannotTeach({ data }: MatrixItem): boolean {
  switch (data.form) {
    // The scene works out the first cell.
    case 'mult':
      return data.A[0].every((cell, k) => cell.mul(data.B[k][0]).isZero());
    case 'index':
      return data.i === data.j;
    case 'transpose':
      return equals(data.A, transpose(data.A));
    case 'det2': {
      const [[a, b], [c, d]] = data.A;
      return a.mul(d).isZero() || b.mul(c).isZero();
    }
    case 'det3': {
      const { down, up } = sarrusLines(data.A);
      const live = (lines: Rational[]) => lines.filter((line) => !line.isZero()).length;
      return live(down) === 0 || live(up) === 0 || live(down) + live(up) < MIN_LIVE_SARRUS_LINES;
    }
    // k = ±1 leaves the area as it was, so k² has nothing to show.
    case 'det_scaled':
      return Math.abs(data.k) < 2;
    default:
      return false;
  }
}

function conceptLevel(skill: SkillId, level: Level): Level {
  switch (skill) {
    // L3 of these has another form: 2A − 3B, and ABC. The concept is the same at L2.
    case 'scalar':
    case 'mult_defined':
      return Math.min(level, 2) as Level;
    case 'det_props':
    case 'invertible':
      return 1;
    // det = ±1 at L1 hides the divide step.
    case 'inv2':
      return Math.max(level, 2) as Level;
    default:
      return level;
  }
}

/** `det_zero` needs a singular example. Other skills take whatever the generator draws. */
const CONCEPT_TARGET: Partial<Record<SkillId, MisconceptionId>> = {
  invertible: 'M18_INV_SINGULAR',
};

export interface ConceptOptions {
  seed: number;
  level?: Level;
  /** The item being worked on. The example never gives it away. */
  avoid?: MatrixItem;
  purpose?: Extract<ScenePurpose, 'concept' | 'request'>;
}

/** The generator's sibling for a concept scene (SCENES §5.1). Null when the scene has no item. */
export function conceptExample(
  skill: SkillId,
  { seed, level = 1, avoid }: ConceptOptions,
): MatrixItem | null {
  if (skill === 'mult_noncomm') return null;
  for (let nth = 0; nth < MAX_EXAMPLE_TRIES; nth += 1) {
    const example = generate({
      skill,
      difficulty: conceptLevel(skill, level),
      seed: exampleSeed(seed, nth),
      target: CONCEPT_TARGET[skill],
    });
    if (!cannotTeach(example) && !givesAway(example, avoid)) return example;
  }
  throw new Error(`conceptExample: no usable example of ${skill} from seed ${seed}`);
}

export function conceptScene(skill: SkillId, options: ConceptOptions): SceneSpec {
  const purpose = options.purpose ?? 'concept';
  if (skill === 'mult_noncomm') {
    return gridScene({ mode: 'compose', ...composePair(options.seed, options.avoid), purpose });
  }
  const example = conceptExample(skill, options);
  if (!example) throw new Error(`conceptScene: ${skill} has no example`);
  const { data } = example;
  switch (data.form) {
    case 'dim':
      return dimensionScene({ op: 'single', first: shape(data.A), values: data.A, purpose });
    case 'addsub': {
      // Mismatched dims have no working to show, so that example teaches the check instead.
      const fits =
        shape(data.A).rows === shape(data.B).rows && shape(data.A).cols === shape(data.B).cols;
      return fits
        ? cellByCellScene({ op: data.op, left: data.A, right: data.B, purpose })
        : dimensionScene({ op: 'add', first: shape(data.A), second: shape(data.B), purpose });
    }
    case 'scalar':
      return cellByCellScene({ op: 'scalar', left: data.A, k: Rational.of(data.k), purpose });
    case 'mult_defined': {
      const isAB = data.order === 'AB';
      return dimensionScene({
        op: 'mult',
        first: isAB ? data.dimsA : data.dimsB,
        second: isAB ? data.dimsB : data.dimsA,
        names: { first: isAB ? 'A' : 'B', second: isAB ? 'B' : 'A' },
        purpose,
      });
    }
    case 'mult':
      return rowColDotScene({ left: data.A, right: data.B, purpose });
    case 'det_scaled':
      return gridScene({
        mode: 'scale_k',
        M: matrixWithDet(data.d),
        k: data.k,
        d: data.d,
        n: data.n,
        purpose,
      });
    case 'invertible':
      return gridScene({ mode: 'det_zero', M: data.A, purpose });
    case 'inv2':
      return inverseScene({ A: data.A, purpose });
    case 'index':
      return cellLocatorScene({ A: data.A, i: data.i, j: data.j, purpose });
    case 'transpose':
      return transposeScene({ A: data.A, purpose });
    case 'det2':
    case 'det3':
      return sarrusScene({ A: data.A, purpose });
    default:
      return workedScene(example, purpose);
  }
}

/** "ดูวิธีทำ" (SPEC §4). The item is closed, so its own numbers are fine. */
export function revealScene(item: Pick<MatrixItem, 'data' | 'correct'>): SceneSpec {
  return workedScene(item, 'reveal');
}

export interface Caught {
  id: MisconceptionId;
  variant?: string;
}

/** A 2×2 stand-in for a 3×3 `invertible` item, which a plane cannot show. */
function invertibleMatrix(item: MatrixItem, id: MisconceptionId): { M: Matrix; example: boolean } {
  const { data } = item;
  if (data.form !== 'invertible') throw new Error(`remediationScene: ${id} on ${data.form}`);
  if (data.A.length === 2) return { M: data.A, example: false };
  const sibling = generate({
    skill: 'invertible',
    difficulty: id === 'M18_INV_SINGULAR' ? 1 : 2,
    seed: exampleSeed(item.ref.seed, 0),
    target: id,
  });
  if (sibling.data.form !== 'invertible') throw new Error('remediationScene: wrong sibling');
  return { M: sibling.data.A, example: true };
}

const GRID_MISTAKES: Partial<Record<MisconceptionId, GridMistake>> = {
  M11_MULT_COMMUTATIVE: 'M11',
  M14_DET_SCALAR_LINEAR: 'M14',
  M18_INV_SINGULAR: 'M18',
  M19_INV_ZERO_ENTRY: 'M19',
};

function gridRemediation(
  item: MatrixItem,
  answer: Answer,
  { id }: Caught,
  ref: SceneRef,
): SceneSpec {
  const shared = {
    purpose: 'remediate' as const,
    studentAnswer: answer,
    mistake: GRID_MISTAKES[id],
  };
  const { data } = item;
  switch (ref.mode) {
    case 'compose':
      return gridScene({
        mode: 'compose',
        ...composePair(exampleSeed(item.ref.seed, 0), item),
        example: true,
        ...shared,
      });
    case 'scale_k': {
      if (data.form !== 'det_scaled') throw new Error(`remediationScene: ${id} on ${data.form}`);
      return gridScene({
        mode: 'scale_k',
        M: matrixWithDet(data.d),
        k: data.k,
        d: data.d,
        n: data.n,
        example: data.n !== 2,
        ...shared,
      });
    }
    case 'det_zero':
      return gridScene({ mode: 'det_zero', ...invertibleMatrix(item, id), ...shared });
    case 'undo':
      return gridScene({
        mode: 'undo',
        ...invertibleMatrix(item, id),
        ...shared,
        captions: { back: th.scenes.grid.zero_entry },
      });
    default:
      throw new Error(`remediationScene: ${id} has grid mode ${ref.mode}`);
  }
}

function dimensionRemediation(item: MatrixItem, answer: Answer, caught: Caught): SceneSpec {
  const shared = {
    purpose: 'remediate' as const,
    studentAnswer: answer,
    variant: caught.variant,
    student:
      answer.kind === 'dims'
        ? { rows: answer.rows, cols: answer.cols }
        : answer.kind === 'undefined'
          ? ('undefined' as const)
          : undefined,
  };
  const { data } = item;
  switch (data.form) {
    case 'dim':
      return dimensionScene({ op: 'single', first: shape(data.A), values: data.A, ...shared });
    case 'addsub':
      return dimensionScene({ op: 'add', first: shape(data.A), second: shape(data.B), ...shared });
    case 'mult_defined': {
      const isAB = data.order === 'AB';
      return dimensionScene({
        op: 'mult',
        first: isAB ? data.dimsA : data.dimsB,
        second: isAB ? data.dimsB : data.dimsA,
        names: { first: isAB ? 'A' : 'B', second: isAB ? 'B' : 'A' },
        ...shared,
      });
    }
    default:
      throw new Error(`remediationScene: ${caught.id} on ${data.form}`);
  }
}

/**
 * The scene for a caught misconception, compare mode where the template has one (SCENES §3). The item
 * is closed, so it plays the student's own numbers. Only forms with no 2×2 to draw use an example.
 */
export function remediationScene(
  item: MatrixItem,
  answer: Answer,
  caught: Caught,
  theme: ThemeId = 'shop',
): SceneSpec {
  const { data } = item;
  const ref = sceneFor(caught.id, { kind: item.kind, variant: caught.variant });
  const purpose = 'remediate';
  switch (ref.template) {
    case 'cell_locator': {
      if (data.form !== 'index') throw new Error(`remediationScene: ${caught.id} on ${data.form}`);
      return cellLocatorScene({
        A: data.A,
        i: data.i,
        j: data.j,
        showSwapped: true,
        studentAnswer: answer,
        purpose,
      });
    }
    case 'transpose_flip': {
      if (data.form !== 'transpose') {
        throw new Error(`remediationScene: ${caught.id} on ${data.form}`);
      }
      return transposeScene({
        A: data.A,
        variant: caught.variant as TransposeVariant,
        student: answer.kind === 'matrix' ? answer.value : undefined,
        studentAnswer: answer,
        purpose,
      });
    }
    case 'sarrus': {
      if (data.form !== 'det2' && data.form !== 'det3') {
        throw new Error(`remediationScene: ${caught.id} on ${data.form}`);
      }
      return sarrusScene({
        A: data.A,
        variant: caught.variant as SarrusVariant,
        studentAnswer: answer,
        purpose,
      });
    }
    case 'row_col_dot': {
      const variant = ref.variant as RowColVariant;
      const cell = firstWrongCell(answer, item.correct);
      const student = answer.kind === 'matrix' ? answer.value : undefined;
      if (data.form === 'noncomm_find_ba') {
        return rowColDotScene({
          left: data.B,
          right: data.A,
          names: { left: 'B', right: 'A', result: 'BA' },
          cell,
          variant,
          student,
          studentAnswer: answer,
          purpose,
        });
      }
      if (data.form !== 'mult') throw new Error(`remediationScene: ${caught.id} on ${data.form}`);
      const bill =
        variant === 'elementwise' && student ? billOf(data.A, data.B, student, theme) : null;
      return rowColDotScene({
        left: data.A,
        right: data.B,
        cell: bill?.cell ?? cell,
        variant,
        student,
        story: bill?.story,
        studentAnswer: answer,
        purpose,
      });
    }
    case 'dimension_match':
      return dimensionRemediation(item, answer, caught);
    case 'grid_transform':
      return gridRemediation(item, answer, caught, ref);
    case 'inverse_recipe': {
      if (data.form !== 'inv2') throw new Error(`remediationScene: ${caught.id} on ${data.form}`);
      return inverseScene({
        A: data.A,
        variant: ref.variant as InverseVariant,
        student: answer.kind === 'matrix' ? answer.value : undefined,
        studentAnswer: answer,
        purpose,
      });
    }
    case 'cell_by_cell':
      return cellByCellRemediation(item, answer, caught);
    case 'det_sum': {
      if (data.form !== 'det_sum')
        throw new Error(`remediationScene: ${caught.id} on ${data.form}`);
      return detSumScene({ A: data.A, B: data.B, studentAnswer: answer, purpose });
    }
    case 'worked_solution':
      return workedScene(item, purpose, { studentAnswer: answer, variant: caught.variant });
  }
}

/** M05 and M07: the student's own answer beside the same cells worked out properly. */
function cellByCellRemediation(item: MatrixItem, answer: Answer, caught: Caught): SceneSpec {
  const { data, correct } = item;
  const shared = {
    purpose: 'remediate' as const,
    studentAnswer: answer,
    variant: caught.variant ?? 'REVERSED',
    focus: firstWrongCell(answer, correct),
    ...(answer.kind === 'matrix' && { student: answer.value }),
  };
  switch (data.form) {
    case 'addsub':
      return cellByCellScene({ op: data.op, left: data.A, right: data.B, ...shared });
    case 'scalar':
      return cellByCellScene({ op: 'scalar', left: data.A, k: Rational.of(data.k), ...shared });
    // 2A − 3B: its first half is the part M07 is about, on the item's own numbers.
    case 'combo':
      return cellByCellScene({
        op: 'scalar',
        left: data.A,
        k: Rational.of(data.p),
        purpose: 'remediate',
        studentAnswer: answer,
        variant: caught.variant ?? 'REVERSED',
      });
    default:
      throw new Error(`remediationScene: ${caught.id} on ${data.form}`);
  }
}

export interface IntroOptions {
  /** Draws this student's own numbers. Without it, the fixed ones of docs/SCENES.md §5. */
  seed?: number;
  /** Which story it tells. */
  theme?: ThemeId;
}

/** The first clip a student sees in a unit, at most 40 seconds (SPEC §4, SCENES §5). */
export function introScene(
  unit: Skill['unit'],
  { seed, theme = 'shop' }: IntroOptions = {},
): SceneSpec {
  const purpose = 'intro';
  const copy = th.scenes.intro;
  const story = copy.stories[theme];
  const numbers = seed === undefined ? DOCUMENTED_NUMBERS : introNumbers(seed);
  switch (unit) {
    case 1: {
      const dims = shape(numbers.sales);
      return dimensionScene({
        op: 'single',
        first: dims,
        values: numbers.sales,
        labels: story.labels,
        purpose,
        captions: {
          blocks: story.u1.blocks,
          count_rows: fillTokens(story.u1.count_rows, { rows: String(dims.rows) }),
          count_cols: fillTokens(story.u1.count_cols, { cols: String(dims.cols) }),
          result: fillTokens(copy.u1_result, { dims: `${dims.rows}×${dims.cols}` }),
        },
      });
    }
    case 2:
      return cellByCellScene({
        op: 'add',
        left: numbers.branchA,
        right: numbers.branchB,
        names: { left: story.u2.left, right: story.u2.right, result: story.u2.result },
        purpose,
        captions: { setup: story.u2.setup, rest: copy.u2_rest, done: story.u2.done },
        also: {
          k: Rational.of(numbers.reorder),
          caption: fillTokens(story.u2.also, { k: String(numbers.reorder) }),
        },
      });
    case 3:
      return rowColDotScene({
        left: numbers.quantities,
        right: numbers.prices,
        names: { left: story.u3.left, right: story.u3.right, result: story.u3.result },
        story: {
          who: story.labels.rows[0],
          labels: { qty: story.u3.left, price: story.u3.right, result: story.u3.result },
          items: story.labels.cols,
        },
        purpose,
        captions: {
          setup: story.u3.setup,
          pick_row: fillTokens(story.u3.pick_row, { i: '1' }),
          pick_col: fillTokens(copy.u3_pick_col, { j: '1' }),
          pair: copy.u3_pair,
          multiply: copy.u3_multiply,
          sum: story.u3.sum,
          fill_rest: story.u3.fill_rest,
        },
      });
    case 4:
      return gridScene({
        mode: 'det_area',
        M: numbers.stretch,
        purpose,
        captions: { apply: copy.u4.apply },
      });
    case 5:
      return gridScene({
        mode: 'undo',
        M: numbers.undoable,
        purpose,
        captions: { unit: copy.u5.unit, undo: copy.u5.undo, back: copy.u5.back },
      });
  }
}
