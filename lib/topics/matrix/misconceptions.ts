import { th, type HintKey } from '@/lib/content/th';
import { diagnosticsCollide } from '@/lib/core/classify';
import { Rational } from '@/lib/core/rational';
import {
  ANY_MATRIX,
  type Answer,
  type DiagnosticAnswer,
  type Dims,
  type ItemKind,
  type Level,
  type Matrix,
} from '@/lib/core/types';
import {
  add,
  adjugate2,
  det,
  det2,
  equals,
  hadamard,
  isSquare,
  minor,
  mul,
  sameDims,
  sameShape,
  sarrusLines,
  scalar,
  shape,
  sub,
  sum,
  transpose,
} from './ops';
import type { SkillId } from './skills';
import {
  NONCOMM_STATEMENT_IS_TRUE,
  type DataOf,
  type FormId,
  type ItemBody,
  type MatrixData,
  type MatrixDiagnostic,
  type MisconceptionId,
} from './types';

export type SceneTemplate =
  | 'row_col_dot'
  | 'dimension_match'
  | 'grid_transform'
  | 'inverse_recipe'
  | 'worked_solution'
  | 'cell_locator'
  | 'transpose_flip'
  | 'sarrus';

export interface SceneRef {
  template: SceneTemplate;
  mode?: string;
  variant?: string;
  /** Used until this Tier B template exists. */
  fallback?: 'worked_solution';
}

interface SceneContext {
  kind?: ItemKind;
  variant?: string;
}

interface ItemWithData {
  data: MatrixData;
}

export interface VariantSpec {
  variant?: string;
  applies(item: ItemWithData): boolean;
  candidate(item: ItemWithData): DiagnosticAnswer;
}

export interface ProbeRow {
  skill: SkillId;
  /** Levels from MISCONCEPTIONS §4.1. */
  levels: Level[];
  /** Variants that only some of those levels can show. */
  variantLevels?: Record<string, Level[]>;
}

export interface MisconceptionEntry {
  id: MisconceptionId;
  nameTh: string;
  skills: SkillId[];
  hintKey: HintKey;
  scene: SceneRef | ((context: SceneContext) => SceneRef);
  probes: ProbeRow[];
  variants: VariantSpec[];
}

/** One way to get an item wrong, defined for a single item form. */
function on<F extends FormId>(
  form: F,
  spec: {
    variant?: string;
    applies?: (data: DataOf<F>) => boolean;
    candidate: (data: DataOf<F>) => DiagnosticAnswer;
  },
): VariantSpec {
  const narrow = (item: ItemWithData): DataOf<F> | null =>
    item.data.form === form ? (item.data as DataOf<F>) : null;
  return {
    variant: spec.variant,
    applies: (item) => {
      const data = narrow(item);
      return data !== null && (spec.applies?.(data) ?? true);
    },
    candidate: (item) => {
      const data = narrow(item);
      if (data === null) throw new Error(`candidate: expected form ${form}, got ${item.data.form}`);
      return spec.candidate(data);
    },
  };
}

const asMatrix = (value: Matrix): Answer => ({ kind: 'matrix', value });
const asNumber = (value: Rational): Answer => ({ kind: 'scalar', value });
const asDims = ({ rows, cols }: Dims): Answer => ({ kind: 'dims', rows, cols });
const asChoice = (id: string): Answer => ({ kind: 'choice', id });
const UNDEFINED: Answer = { kind: 'undefined' };

/** Rebuilds a same-size matrix cell by cell; i and j are 0-based. */
function build(rows: number, cols: number, cell: (i: number, j: number) => Rational): Matrix {
  return Array.from({ length: rows }, (_, i) => Array.from({ length: cols }, (_, j) => cell(i, j)));
}

/** The two matrices being multiplied, in the order the item asks for. */
function factors(data: DataOf<'mult_defined'>): { first: Dims; second: Dims } {
  return data.order === 'AB'
    ? { first: data.dimsA, second: data.dimsB }
    : { first: data.dimsB, second: data.dimsA };
}

const hasZero = (A: Matrix): boolean => A.some((row) => row.some((cell) => cell.isZero()));

const commute = (A: Matrix, B: Matrix): boolean => equals(mul(A, B), mul(B, A));

function entry(fields: Omit<MisconceptionEntry, 'nameTh' | 'skills'>): MisconceptionEntry {
  return {
    ...fields,
    nameTh: th.misconceptionNames[fields.id],
    skills: fields.probes.map((row) => row.skill),
  };
}

const m12Applies = ({ A }: DataOf<'det2'>): boolean =>
  !A[0][1].mul(A[1][0]).isZero() && !det2(A).isZero();

const m20DividesByDet = ({ A }: DataOf<'inv2'>): boolean =>
  det2(A).abs().compare(Rational.of(2)) >= 0;

/** Scales a 2×2 inverse-recipe matrix by 1/det. */
const overDet = (A: Matrix, body: Matrix): Answer => asMatrix(scalar(det2(A).inv(), body));

/** Catalog order decides which diagnostic wins a tie, so it follows MISCONCEPTIONS §3. */
export const CATALOG: MisconceptionEntry[] = [
  entry({
    id: 'M01_DIM_SWAP',
    hintKey: 'M01_DIM_SWAP',
    scene: { template: 'dimension_match', mode: 'single' },
    probes: [{ skill: 'dim', levels: [1, 2, 3] }],
    variants: [
      on('dim', {
        applies: ({ A }) => !isSquare(A),
        candidate: ({ A }) => asDims({ rows: shape(A).cols, cols: shape(A).rows }),
      }),
    ],
  }),
  entry({
    id: 'M02_INDEX_SWAP',
    hintKey: 'M02_INDEX_SWAP',
    scene: { template: 'cell_locator', fallback: 'worked_solution' },
    probes: [{ skill: 'index', levels: [1, 2, 3] }],
    variants: [
      on('index', {
        applies: ({ A, i, j }) => {
          const exists = j <= A.length && i <= A[0].length;
          return exists && !A[j - 1][i - 1].equals(A[i - 1][j - 1]);
        },
        candidate: ({ A, i, j }) => asNumber(A[j - 1][i - 1]),
      }),
    ],
  }),
  entry({
    id: 'M03_TRANSPOSE_WRONG',
    hintKey: 'M03_TRANSPOSE_WRONG',
    scene: { template: 'transpose_flip', fallback: 'worked_solution' },
    probes: [
      {
        skill: 'transpose',
        levels: [1, 2, 3],
        // The answer grid has the shape of Aᵀ, so these three only fit a square A.
        variantLevels: { FLIP_H: [1, 3], FLIP_V: [1, 3], SAME: [1, 3] },
      },
    ],
    variants: [
      on('transpose', {
        variant: 'ROT_CW',
        candidate: ({ A }) => {
          const { rows: m, cols: n } = shape(A);
          return asMatrix(build(n, m, (i, j) => A[m - 1 - j][i]));
        },
      }),
      on('transpose', {
        variant: 'ROT_CCW',
        candidate: ({ A }) => {
          const { rows: m, cols: n } = shape(A);
          return asMatrix(build(n, m, (i, j) => A[j][n - 1 - i]));
        },
      }),
      on('transpose', {
        variant: 'ANTI',
        candidate: ({ A }) => {
          const { rows: m, cols: n } = shape(A);
          return asMatrix(build(n, m, (i, j) => A[m - 1 - j][n - 1 - i]));
        },
      }),
      on('transpose', {
        variant: 'FLIP_H',
        applies: ({ A }) => isSquare(A),
        candidate: ({ A }) => asMatrix(A.map((row) => [...row].reverse())),
      }),
      on('transpose', {
        variant: 'FLIP_V',
        applies: ({ A }) => isSquare(A),
        candidate: ({ A }) => asMatrix([...A].reverse()),
      }),
      on('transpose', {
        variant: 'SAME',
        applies: ({ A }) => isSquare(A),
        candidate: ({ A }) => asMatrix(A),
      }),
    ],
  }),
  entry({
    id: 'M04_ADD_DIM_MISMATCH',
    hintKey: 'M04_ADD_DIM_MISMATCH',
    scene: { template: 'dimension_match', mode: 'add' },
    probes: [{ skill: 'addsub', levels: [2, 3] }],
    variants: [
      on('addsub', {
        applies: ({ A, B }) => !sameShape(A, B),
        candidate: () => ANY_MATRIX,
      }),
    ],
  }),
  entry({
    id: 'M05_SUB_REVERSED',
    hintKey: 'M05_SUB_REVERSED',
    scene: { template: 'worked_solution' },
    probes: [{ skill: 'addsub', levels: [2, 3] }],
    variants: [
      on('addsub', {
        applies: ({ op, A, B }) => op === 'sub' && sameShape(A, B) && !equals(A, B),
        candidate: ({ A, B }) => asMatrix(sub(B, A)),
      }),
    ],
  }),
  entry({
    id: 'M07_SCALAR_PARTIAL',
    hintKey: 'M07_SCALAR_PARTIAL',
    scene: { template: 'worked_solution', mode: 'all_cells' },
    probes: [{ skill: 'scalar', levels: [1, 2] }],
    variants: [
      on('scalar', {
        variant: 'FIRST_ROW',
        candidate: ({ k, A }) =>
          asMatrix(
            A.map((row, i) => row.map((cell) => (i === 0 ? cell.mul(Rational.of(k)) : cell))),
          ),
      }),
      on('scalar', {
        variant: 'DIAGONAL',
        candidate: ({ k, A }) =>
          asMatrix(
            A.map((row, i) => row.map((cell, j) => (i === j ? cell.mul(Rational.of(k)) : cell))),
          ),
      }),
      on('scalar', {
        variant: 'ADD',
        candidate: ({ k, A }) =>
          asMatrix(A.map((row) => row.map((cell) => cell.add(Rational.of(k))))),
      }),
    ],
  }),
  entry({
    id: 'M08_MULT_DIM_RULE',
    hintKey: 'M08_MULT_DIM_RULE',
    scene: { template: 'dimension_match', mode: 'mult' },
    probes: [{ skill: 'mult_defined', levels: [1, 2] }],
    variants: [
      on('mult_defined', {
        variant: 'SAME_DIMS',
        // Decides by "same dims" instead of "inner dims match", so it only shows when the two disagree.
        applies: (data) => {
          const { first, second } = factors(data);
          return sameDims(first, second) !== (first.cols === second.rows);
        },
        candidate: (data) => {
          const { first, second } = factors(data);
          return sameDims(first, second) ? asDims(first) : UNDEFINED;
        },
      }),
      on('mult_defined', {
        variant: 'RESULT_INNER',
        applies: (data) => {
          const { first, second } = factors(data);
          return !(first.cols === first.rows && first.cols === second.cols);
        },
        candidate: (data) => {
          const n = factors(data).first.cols;
          return asDims({ rows: n, cols: n });
        },
      }),
      on('mult_defined', {
        variant: 'RESULT_FIRST',
        applies: (data) => {
          const { first, second } = factors(data);
          return first.cols !== second.cols;
        },
        candidate: (data) => asDims(factors(data).first),
      }),
      on('mult_defined', {
        variant: 'RESULT_SWAPPED',
        applies: (data) => {
          const { first, second } = factors(data);
          return second.cols !== first.rows;
        },
        candidate: (data) => {
          const { first, second } = factors(data);
          return asDims({ rows: second.cols, cols: first.rows });
        },
      }),
    ],
  }),
  entry({
    id: 'M09_MULT_ELEMENTWISE',
    hintKey: 'M09_MULT_ELEMENTWISE',
    scene: { template: 'row_col_dot', mode: 'compare', variant: 'elementwise' },
    probes: [{ skill: 'mult', levels: [1, 2] }],
    variants: [
      on('mult', {
        applies: ({ A, B }) => sameShape(A, B),
        candidate: ({ A, B }) => asMatrix(hadamard(A, B)),
      }),
    ],
  }),
  entry({
    id: 'M10_MULT_ROW_ROW',
    hintKey: 'M10_MULT_ROW_ROW',
    scene: ({ variant }) => ({
      template: 'row_col_dot',
      mode: 'compare',
      variant: variant === 'COL_COL' ? 'col_col' : 'row_row',
    }),
    probes: [{ skill: 'mult', levels: [1, 2, 3] }],
    variants: [
      on('mult', {
        variant: 'ROW_ROW',
        applies: ({ A, B }) => shape(A).cols === shape(B).cols,
        candidate: ({ A, B }) => asMatrix(mul(A, transpose(B))),
      }),
      on('mult', {
        variant: 'COL_COL',
        applies: ({ A, B }) => shape(A).rows === shape(B).rows,
        candidate: ({ A, B }) => asMatrix(mul(transpose(A), B)),
      }),
    ],
  }),
  entry({
    id: 'M11_MULT_COMMUTATIVE',
    hintKey: 'M11_MULT_COMMUTATIVE',
    scene: ({ kind }) =>
      kind === 'choice'
        ? { template: 'grid_transform', mode: 'compose' }
        : { template: 'row_col_dot', mode: 'compare', variant: 'reversed' },
    probes: [
      { skill: 'mult', levels: [1, 2] },
      { skill: 'mult_noncomm', levels: [1, 2, 3] },
    ],
    variants: [
      on('mult', {
        // BA must also fit the answer grid, which rules out every non-square pair.
        applies: ({ A, B }) => isSquare(A) && sameShape(A, B) && !commute(A, B),
        candidate: ({ A, B }) => asMatrix(mul(B, A)),
      }),
      on('noncomm_find_ba', {
        applies: ({ A, B }) => !commute(A, B),
        candidate: ({ AB }) => asMatrix(AB),
      }),
      on('noncomm_statement', {
        candidate: ({ statement }) =>
          asChoice(NONCOMM_STATEMENT_IS_TRUE[statement] ? 'false' : 'true'),
      }),
      on('noncomm_pair', {
        applies: ({ A, B }) => !commute(A, B),
        candidate: () => asChoice('swap_yes'),
      }),
    ],
  }),
  entry({
    id: 'M12_DET2_FORMULA',
    hintKey: 'M12_DET2_FORMULA',
    scene: { template: 'sarrus', mode: '2x2', fallback: 'worked_solution' },
    probes: [{ skill: 'det2', levels: [1, 2] }],
    variants: [
      on('det2', {
        variant: 'ADD',
        applies: m12Applies,
        candidate: ({ A: [[a, b], [c, d]] }) => asNumber(a.mul(d).add(b.mul(c))),
      }),
      on('det2', {
        variant: 'REVERSE',
        applies: m12Applies,
        candidate: ({ A: [[a, b], [c, d]] }) => asNumber(b.mul(c).sub(a.mul(d))),
      }),
      on('det2', {
        variant: 'PAIRS_ROW',
        applies: m12Applies,
        candidate: ({ A: [[a, b], [c, d]] }) => asNumber(a.mul(b).sub(c.mul(d))),
      }),
      on('det2', {
        variant: 'PAIRS_COL',
        applies: m12Applies,
        candidate: ({ A: [[a, b], [c, d]] }) => asNumber(a.mul(c).sub(b.mul(d))),
      }),
    ],
  }),
  entry({
    id: 'M13_DET3_SIGN',
    hintKey: 'M13_DET3_SIGN',
    scene: { template: 'sarrus', mode: '3x3', fallback: 'worked_solution' },
    probes: [{ skill: 'det3', levels: [1, 2, 3] }],
    variants: [
      on('det3', {
        variant: 'ALL_PLUS',
        candidate: ({ A }) => {
          const { down, up } = sarrusLines(A);
          return asNumber(sum([...down, ...up]));
        },
      }),
      on('det3', {
        variant: 'NO_ALT_SIGN',
        candidate: ({ A }) => asNumber(sum(A[0].map((cell, j) => cell.mul(minor(A, 1, j + 1))))),
      }),
      on('det3', {
        variant: 'TWO_DIAG',
        candidate: ({ A }) => {
          const { down, up } = sarrusLines(A);
          return asNumber(down[0].sub(up[0]));
        },
      }),
    ],
  }),
  entry({
    id: 'M14_DET_SCALAR_LINEAR',
    hintKey: 'M14_DET_SCALAR_LINEAR',
    scene: { template: 'grid_transform', mode: 'scale_k' },
    probes: [{ skill: 'det_props', levels: [1, 2] }],
    variants: [
      on('det_scaled', {
        applies: ({ n, d, k }) =>
          k !== 0 && k !== 1 && d !== 0 && n >= 2 && !(k === -1 && n % 2 === 1),
        candidate: ({ d, k }) => asNumber(Rational.of(k).mul(Rational.of(d))),
      }),
    ],
  }),
  entry({
    id: 'M15_DET_ADDITIVE',
    hintKey: 'M15_DET_ADDITIVE',
    scene: { template: 'worked_solution' },
    probes: [{ skill: 'det_props', levels: [2] }],
    variants: [
      on('det_sum', {
        applies: ({ A, B }) =>
          !det2(A)
            .add(det2(B))
            .equals(det2(add(A, B))),
        candidate: ({ A, B }) => asNumber(det2(A).add(det2(B))),
      }),
    ],
  }),
  entry({
    id: 'M18_INV_SINGULAR',
    hintKey: 'M18_INV_SINGULAR',
    scene: { template: 'grid_transform', mode: 'det_zero' },
    probes: [{ skill: 'invertible', levels: [1, 2, 3] }],
    variants: [
      on('invertible', {
        applies: ({ A }) => det(A).isZero(),
        candidate: () => asChoice('has_inverse'),
      }),
    ],
  }),
  entry({
    id: 'M19_INV_ZERO_ENTRY',
    hintKey: 'M19_INV_ZERO_ENTRY',
    scene: { template: 'grid_transform', mode: 'undo' },
    probes: [{ skill: 'invertible', levels: [2, 3] }],
    variants: [
      on('invertible', {
        applies: ({ A }) => hasZero(A) && !det(A).isZero(),
        candidate: () => asChoice('no_inverse'),
      }),
    ],
  }),
  entry({
    id: 'M20_INV2_RECIPE',
    hintKey: 'M20_INV2_RECIPE',
    scene: ({ variant }) => ({ template: 'inverse_recipe', mode: 'compare', variant }),
    probes: [
      {
        skill: 'inv2',
        levels: [1, 2, 3],
        // det = ±1 at L1 makes dividing by det invisible.
        variantLevels: { NO_DIVIDE: [2, 3], TIMES_DET: [2, 3] },
      },
    ],
    variants: [
      on('inv2', {
        variant: 'NO_SWAP',
        applies: ({ A: [[a], [, d]] }) => !a.equals(d),
        candidate: ({ A }) => {
          const [[a, b], [c, d]] = A;
          return overDet(A, [
            [a, b.neg()],
            [c.neg(), d],
          ]);
        },
      }),
      on('inv2', {
        variant: 'NO_NEGATE',
        applies: ({ A: [[, b], [c]] }) => !b.isZero() && !c.isZero(),
        candidate: ({ A }) => {
          const [[a, b], [c, d]] = A;
          return overDet(A, [
            [d, b],
            [c, a],
          ]);
        },
      }),
      on('inv2', {
        variant: 'NO_DIVIDE',
        applies: m20DividesByDet,
        candidate: ({ A }) => asMatrix(adjugate2(A)),
      }),
      on('inv2', {
        variant: 'TIMES_DET',
        applies: m20DividesByDet,
        candidate: ({ A }) => asMatrix(scalar(det2(A), adjugate2(A))),
      }),
      on('inv2', {
        variant: 'TRANSPOSED',
        applies: ({ A: [[, b], [c]] }) => !b.equals(c),
        candidate: ({ A }) => {
          const [[a, b], [c, d]] = A;
          return overDet(A, [
            [d, c.neg()],
            [b.neg(), a],
          ]);
        },
      }),
    ],
  }),
  entry({
    id: 'M21_INV_RECIPROCAL',
    hintKey: 'M21_INV_RECIPROCAL',
    scene: { template: 'inverse_recipe', mode: 'compare', variant: 'RECIPROCAL' },
    probes: [{ skill: 'inv2', levels: [1, 2, 3] }],
    variants: [
      on('inv2', {
        applies: ({ A }) => !hasZero(A),
        candidate: ({ A }) => asMatrix(A.map((row) => row.map((cell) => cell.inv()))),
      }),
    ],
  }),
];

export function catalogEntry(id: MisconceptionId): MisconceptionEntry {
  const found = CATALOG.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`catalogEntry: unknown misconception ${id}`);
  return found;
}

/** Variant names of a misconception, in catalog order. [undefined] when it has no named variants. */
export function variantsOf(id: MisconceptionId): (string | undefined)[] {
  return [...new Set(catalogEntry(id).variants.map((spec) => spec.variant))];
}

/** Levels where this misconception can be probed on this skill, per MISCONCEPTIONS §4.1. */
export function probeLevels(skill: SkillId, id: MisconceptionId, variant?: string): Level[] {
  const entryFound = catalogEntry(id);
  const row = entryFound.probes.find((candidate) => candidate.skill === skill);
  if (!row) return [];
  if (variant === undefined) return row.levels;
  if (!variantsOf(id).includes(variant)) return [];
  return row.variantLevels?.[variant] ?? row.levels;
}

/** Nearest level that can show this misconception; a tie goes to the easier level. */
export function probeLevel(
  skill: SkillId,
  id: MisconceptionId,
  level: Level,
  variant?: string,
): Level {
  const levels = probeLevels(skill, id, variant);
  if (levels.length === 0) {
    throw new Error(
      `probeLevel: ${id}${variant ? `:${variant}` : ''} cannot be probed on ${skill}`,
    );
  }
  let best = levels[0];
  for (const candidate of levels) {
    if (Math.abs(candidate - level) < Math.abs(best - level)) best = candidate;
  }
  return best;
}

export function sceneFor(id: MisconceptionId, context: SceneContext = {}): SceneRef {
  const { scene } = catalogEntry(id);
  return typeof scene === 'function' ? scene(context) : scene;
}

/**
 * Every applicable candidate for this item: target first, then catalog order. A collision between
 * two non-target diagnostics drops the later one (MISCONCEPTIONS §2 rule 2). A collision involving
 * the target stays in the list, so validateItem rejects the item and the generator resamples.
 */
export function buildDiagnostics(
  skill: SkillId,
  body: ItemBody,
  target?: MisconceptionId,
  targetVariant?: string,
): MatrixDiagnostic[] {
  const all: MatrixDiagnostic[] = [];
  for (const { id, skills, variants } of CATALOG) {
    if (!skills.includes(skill)) continue;
    for (const spec of variants) {
      if (!spec.applies(body)) continue;
      const answer = spec.candidate(body);
      all.push(spec.variant === undefined ? { id, answer } : { id, variant: spec.variant, answer });
    }
  }

  const rank = ({ id, variant }: MatrixDiagnostic): number => {
    if (id !== target) return 2;
    return targetVariant === undefined || variant === targetVariant ? 0 : 1;
  };
  const ordered = [...all].sort((a, b) => rank(a) - rank(b));

  const kept: MatrixDiagnostic[] = [];
  for (const diagnostic of ordered) {
    const clash = kept.find((other) => diagnosticsCollide(other.answer, diagnostic.answer));
    if (clash && clash.id !== target && diagnostic.id !== target) continue;
    kept.push(diagnostic);
  }
  return kept;
}
