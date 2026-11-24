import { thVector, type VectorHintKey } from '@/lib/content/th.vector';
import { countDiffComponents, diagnosticsCollide } from '@/lib/core/classify';
import { Rational } from '@/lib/core/rational';
import { Surd } from '@/lib/core/surd';
import type { DiagnosticAnswer, ItemKind, Level } from '@/lib/core/types';
import { figureKey } from './format';
import { cross, det2, dot, isZeroVec, norm, normSq, sinOf, sub, sum, toSurds, triple } from './ops';
import type { SkillId } from './skills';
import {
  askedValue,
  crossFactors,
  exprValue,
  isUnknown,
  linearVec,
  optionWithValue,
  parallelK,
  partnerOf,
  QUANTITY_PARTNER,
  quantityKey,
  quantityMatches,
  solve,
  termValue,
  triangleSides,
  unknownAt,
} from './solve';
import type {
  DataOf,
  Figure,
  FormId,
  ItemBody,
  MisconceptionId,
  Term,
  Vec,
  VectorAnswer,
  VectorData,
  VectorDiagnostic,
} from './types';

/** Scene templates of docs/VECTORS.md §5. The scenes themselves are a later phase. */
export type VectorTemplateId =
  | 'quantity_sort'
  | 'arrow_chain'
  | 'component_steps'
  | 'parallel_scale'
  | 'magnitude_box'
  | 'unit_shrink'
  | 'dot_pairs'
  | 'angle_fan'
  | 'cross_cover'
  | 'area_volume'
  | 'worked_solution';

export interface SceneRef {
  template: VectorTemplateId;
  mode?: string;
  variant?: string;
}

interface SceneContext {
  kind?: ItemKind;
  variant?: string;
}

interface ItemWithData {
  data: VectorData;
}

export interface VariantSpec {
  variant?: string;
  /** May differ from the correct vector in one component only (rule 3's exception, V20). */
  oneOff?: true;
  applies(item: ItemWithData): boolean;
  candidate(item: ItemWithData): DiagnosticAnswer;
}

export interface ProbeRow {
  skill: SkillId;
  /** Levels from docs/VECTORS.md §4.1. */
  levels: Level[];
  /** Variants that only some of those levels can show. */
  variantLevels?: Record<string, Level[]>;
}

export interface MisconceptionEntry {
  id: MisconceptionId;
  nameTh: string;
  shortTh: string;
  skills: SkillId[];
  hintKey: VectorHintKey;
  scene: SceneRef | ((context: SceneContext) => SceneRef);
  probes: ProbeRow[];
  variants: VariantSpec[];
}

/**
 * Whether a candidate can be told apart from the correct answer (rules 1 and 3): any difference for
 * a choice or a number, and at least two components for a vector, or one when `oneOff`.
 */
function distinguishable(candidate: DiagnosticAnswer, correct: VectorAnswer, oneOff: boolean) {
  if (candidate.kind === 'vector' && correct.kind === 'vector') {
    const distance = countDiffComponents(candidate.value, correct.value);
    return distance === null || distance >= (oneOff ? 1 : 2);
  }
  if (candidate.kind === 'surd' && correct.kind === 'surd') {
    return !candidate.value.equals(correct.value);
  }
  if (candidate.kind === 'scalar' && correct.kind === 'scalar') {
    return !candidate.value.equals(correct.value);
  }
  if (candidate.kind === 'choice' && correct.kind === 'choice') return candidate.id !== correct.id;
  return true;
}

/**
 * One way to get an item wrong, defined for a single item form. It applies only where its own
 * condition holds and its answer can be told apart from the correct one, so a diagnostic never
 * fails rules 1 or 3 on its own.
 */
function on<F extends FormId>(
  form: F,
  spec: {
    variant?: string;
    oneOff?: true;
    applies?: (data: DataOf<F>) => boolean;
    candidate: (data: DataOf<F>) => DiagnosticAnswer | null;
  },
): VariantSpec {
  const narrow = (item: ItemWithData): DataOf<F> | null =>
    item.data.form === form ? (item.data as DataOf<F>) : null;
  return {
    variant: spec.variant,
    ...(spec.oneOff && { oneOff: true }),
    applies: (item) => {
      const data = narrow(item);
      if (data === null || !(spec.applies?.(data) ?? true)) return false;
      const answer = spec.candidate(data);
      return answer !== null && distinguishable(answer, solve(data), spec.oneOff === true);
    },
    candidate: (item) => {
      const data = narrow(item);
      if (data === null) throw new Error(`candidate: expected form ${form}, got ${item.data.form}`);
      const answer = spec.candidate(data);
      if (answer === null) throw new Error(`candidate: does not apply to this ${form} item`);
      return answer;
    },
  };
}

const asChoice = (id: string): DiagnosticAnswer => ({ kind: 'choice', id });
const asSurd = (value: Surd): DiagnosticAnswer => ({ kind: 'surd', value });
const asRational = (value: Rational): DiagnosticAnswer => ({
  kind: 'surd',
  value: Surd.rational(value),
});
const asVector = (value: Surd[]): DiagnosticAnswer => ({ kind: 'vector', value });
const asScalar = (value: Rational): DiagnosticAnswer => ({ kind: 'scalar', value });

const nonZeroCount = (v: Vec): number => v.filter((part) => !part.isZero()).length;
const negate = (v: Vec): Vec => v.map((part) => part.neg());

/** The option of a figure item whose vector is `value`, as a choice; null when none is. */
function figureOption(
  figure: Figure,
  options: readonly Term[],
  value: Vec,
): DiagnosticAnswer | null {
  const option = optionWithValue(figure, options, value);
  return option ? asChoice(figureKey(option)) : null;
}

/** u − v in a figure item: two terms, the second subtracted. */
const isDifference = ({ expr }: DataOf<'figure_expr'>): boolean =>
  expr.length === 2 && expr[1].k.sign() < 0;

/** u + v of two whole vectors that start at the same point. */
const isCommonTailSum = ({ expr }: DataOf<'figure_expr'>): boolean =>
  expr.length === 2 && expr.every((t) => t.k.equals(Rational.ONE)) && expr[0].from === expr[1].from;

/** The vector a magnitude item is about: v, pu + qv, or B − A. */
function measured(data: DataOf<'magnitude' | 'magnitude_combo' | 'distance'>): Vec {
  switch (data.form) {
    case 'magnitude':
      return data.v;
    case 'magnitude_combo':
      return linearVec(data.terms);
    case 'distance':
      return sub(data.B, data.A);
  }
}

const absSum = (v: Vec): Rational => sum(v.map((part) => part.abs()));

/** The three item forms whose answer is v/|v|, scaled by `length` when asked. */
type UnitForm = 'unit' | 'scaled_unit' | 'direction_cosines';
const lengthOf = (data: DataOf<UnitForm>): number =>
  data.form === 'scaled_unit' ? data.length : 1;

function unitWrongDivisor(data: DataOf<UnitForm>, divisor: Rational): DiagnosticAnswer | null {
  if (divisor.isZero()) return null;
  const k = Rational.of(lengthOf(data)).div(divisor);
  return asVector(toSurds(data.v.map((part) => part.mul(k))));
}

const unitForms: UnitForm[] = ['unit', 'scaled_unit', 'direction_cosines'];
const magnitudeForms = ['magnitude', 'magnitude_combo', 'distance'] as const;

function entry(
  fields: Omit<MisconceptionEntry, 'nameTh' | 'shortTh' | 'skills' | 'hintKey'>,
): MisconceptionEntry {
  return {
    ...fields,
    nameTh: thVector.misconceptionNames[fields.id],
    shortTh: thVector.misconceptionShort[fields.id],
    hintKey: fields.id,
    skills: fields.probes.map((row) => row.skill),
  };
}

/** Catalog order decides which diagnostic wins a tie, so it follows docs/VECTORS.md §4. */
export const CATALOG: MisconceptionEntry[] = [
  entry({
    id: 'V01_QUANTITY_MIX',
    scene: { template: 'quantity_sort' },
    probes: [{ skill: 'v_quantity', levels: [1] }],
    variants: [
      on('quantity_kind', {
        candidate: (data) => {
          const [answer] = quantityMatches(data);
          const partner = answer === undefined ? undefined : QUANTITY_PARTNER[answer];
          return partner !== undefined && data.options.includes(partner)
            ? asChoice(quantityKey(partner))
            : null;
        },
      }),
    ],
  }),
  entry({
    id: 'V02_EQUAL_IGNORES_DIRECTION',
    scene: { template: 'arrow_chain', mode: 'equal' },
    probes: [{ skill: 'v_quantity', levels: [2, 3] }],
    variants: [
      on('figure_equal', {
        candidate: (data) => figureOption(data.figure, data.options, negate(askedValue(data))),
      }),
    ],
  }),
  entry({
    id: 'V03_GEOM_SUB_DIRECTION',
    scene: { template: 'arrow_chain', mode: 'sub' },
    probes: [{ skill: 'v_geom', levels: [2, 3] }],
    variants: [
      on('figure_expr', {
        applies: isDifference,
        candidate: ({ figure, expr, options }) =>
          figureOption(figure, options, negate(exprValue(figure, expr))),
      }),
    ],
  }),
  entry({
    id: 'V04_GEOM_ADD_JOIN_TIPS',
    scene: { template: 'arrow_chain', mode: 'parallelogram' },
    probes: [{ skill: 'v_geom', levels: [2] }],
    variants: [
      on('figure_expr', {
        applies: isCommonTailSum,
        candidate: ({ figure, expr: [first, second], options }) =>
          figureOption(figure, options, sub(termValue(figure, second), termValue(figure, first))),
      }),
    ],
  }),
  entry({
    id: 'V05_POINTS_REVERSED',
    scene: { template: 'component_steps', mode: 'points' },
    probes: [{ skill: 'v_points', levels: [1, 2] }],
    variants: [
      on('points', {
        applies: ({ A, B }) => nonZeroCount(sub(B, A)) >= 2,
        candidate: ({ A, B }) => asVector(toSurds(sub(A, B))),
      }),
    ],
  }),
  entry({
    id: 'V06_SCALAR_PARTIAL',
    scene: { template: 'component_steps', mode: 'scale' },
    probes: [{ skill: 'v_linear', levels: [1, 2, 3] }],
    variants: [
      on('linear', {
        // Scales the first component only; the others keep the sign written before each term.
        candidate: ({ terms }) =>
          asVector(
            toSurds(
              terms[0].vec.map((_, j) =>
                sum(terms.map(({ k, vec }) => vec[j].mul(Rational.of(j === 0 ? k : Math.sign(k))))),
              ),
            ),
          ),
      }),
    ],
  }),
  entry({
    id: 'V07_COMBO_SIGN',
    scene: { template: 'component_steps', mode: 'combo' },
    probes: [{ skill: 'v_linear', levels: [2, 3] }],
    variants: [
      on('linear', {
        applies: ({ terms }) => terms.some(({ k }) => k < 0),
        candidate: ({ terms }) =>
          asVector(toSurds(linearVec(terms.map((t) => ({ ...t, k: Math.abs(t.k) }))))),
      }),
    ],
  }),
  entry({
    id: 'V08_PARALLEL_RATIO_FLIP',
    scene: { template: 'parallel_scale' },
    probes: [{ skill: 'v_parallel', levels: [1, 2, 3] }],
    variants: [
      on('parallel', {
        // a₁/b₁ = b₂/m instead of a₁/b₁ = m/b₂: the unknown comes out divided by k, not times k.
        candidate: (data) => {
          const k = parallelK(data);
          const { at, partner } = partnerOf(data);
          return asScalar(at.vector === 'u' ? partner.div(k) : partner.mul(k));
        },
      }),
    ],
  }),
  entry({
    id: 'V09_MAG_NO_ROOT',
    scene: { template: 'magnitude_box' },
    probes: [{ skill: 'v_magnitude', levels: [1, 2, 3] }],
    variants: magnitudeForms.map((form) =>
      on(form, {
        applies: (data) => !normSq(measured(data)).equals(Rational.ONE),
        candidate: (data) => asRational(normSq(measured(data))),
      }),
    ),
  }),
  entry({
    id: 'V10_MAG_SUM_COMPONENTS',
    scene: { template: 'magnitude_box', mode: 'compare' },
    probes: [{ skill: 'v_magnitude', levels: [1, 2, 3] }],
    variants: magnitudeForms.map((form) =>
      on(form, {
        applies: (data) => nonZeroCount(measured(data)) >= 2,
        candidate: (data) => asRational(absSum(measured(data))),
      }),
    ),
  }),
  entry({
    id: 'V11_MAG_ADDITIVE',
    scene: { template: 'magnitude_box', mode: 'triangle' },
    probes: [{ skill: 'v_magnitude', levels: [3] }],
    variants: [
      on('magnitude_combo', {
        // |pu + qv| read as |pu| + |qv|. Only when that sum is one Surd (docs/VECTORS.md §3.1).
        applies: ({ terms }) => terms.length >= 2 && terms.every(({ k }) => k > 0),
        candidate: ({ terms }) => {
          let total: Surd | null = Surd.ZERO;
          for (const { k, vec } of terms) {
            total = total?.addSame(norm(vec).mul(Math.abs(k))) ?? null;
          }
          return total === null ? null : asSurd(total);
        },
      }),
    ],
  }),
  entry({
    id: 'V12_UNIT_SQUARED',
    scene: { template: 'unit_shrink' },
    probes: [{ skill: 'v_unit', levels: [1, 2, 3] }],
    variants: unitForms.map((form) =>
      on(form, {
        applies: ({ v }) => !normSq(v).equals(Rational.ONE),
        candidate: (data) => unitWrongDivisor(data, normSq(data.v)),
      }),
    ),
  }),
  entry({
    id: 'V13_UNIT_DIVIDE_SUM',
    scene: { template: 'unit_shrink', mode: 'compare' },
    probes: [{ skill: 'v_unit', levels: [1, 2, 3] }],
    variants: unitForms.map((form) =>
      on(form, {
        applies: ({ v }) => !sum(v).isZero() && !Surd.rational(sum(v)).equals(norm(v)),
        candidate: (data) => unitWrongDivisor(data, sum(data.v)),
      }),
    ),
  }),
  entry({
    id: 'V14_DOT_AS_DET',
    scene: { template: 'dot_pairs' },
    probes: [{ skill: 'v_dot', levels: [1] }],
    variants: [
      on('dot', {
        applies: ({ u }) => u.length === 2,
        candidate: ({ u, v }) => asRational(det2(u, v)),
      }),
    ],
  }),
  entry({
    id: 'V15_DOT_NO_COS',
    scene: { template: 'dot_pairs', mode: 'angle' },
    probes: [{ skill: 'v_dot', levels: [3] }],
    variants: [
      on('dot_polar', {
        applies: ({ theta }) => theta !== 0,
        candidate: ({ normU, normV }) => asSurd(normU.mul(normV)),
      }),
    ],
  }),
  entry({
    id: 'V16_DOT_SIN',
    scene: { template: 'dot_pairs', mode: 'angle' },
    probes: [{ skill: 'v_dot', levels: [3] }],
    variants: [
      on('dot_polar', {
        // At 45° sin and cos agree, so the two answers cannot be told apart.
        applies: ({ theta }) => theta !== 45,
        candidate: ({ normU, normV, theta }) => asSurd(normU.mul(normV).mul(sinOf(theta))),
      }),
    ],
  }),
  entry({
    id: 'V17_ANGLE_ABS',
    scene: { template: 'angle_fan' },
    probes: [{ skill: 'v_angle', levels: [2, 3] }],
    variants: [
      on('angle', {
        applies: (data) => angleAnswer(data) !== 90,
        candidate: (data) => asScalar(Rational.of(180 - angleAnswer(data))),
      }),
    ],
  }),
  entry({
    id: 'V18_ANGLE_SQUARED_NORMS',
    scene: { template: 'angle_fan', mode: 'formula' },
    probes: [{ skill: 'v_angle', levels: [1] }],
    variants: [
      on('cos_angle', {
        applies: ({ u, v }) => !dot(u, v).isZero(),
        candidate: ({ u, v }) => asSurd(Surd.rational(dot(u, v).div(normSq(u).mul(normSq(v))))),
      }),
    ],
  }),
  entry({
    id: 'V19_PERP_AS_PARALLEL',
    scene: { template: 'dot_pairs', mode: 'perp' },
    probes: [{ skill: 'v_perp', levels: [1, 2] }],
    variants: [
      on('perp', {
        // Sets the first given pair in ratio with the pair holding k: u₁/v₁ = k/v₂.
        candidate: ({ u, v }) => {
          const at = unknownAt(u, v, 'k');
          if (!at) return null;
          const [own, other] = at.vector === 'u' ? [u, v] : [v, u];
          const partner = other[at.index];
          if (isUnknown(partner)) return null;
          const i = own.findIndex((part, index) => {
            const across = other[index];
            return index !== at.index && !isUnknown(part) && !isUnknown(across) && !across.isZero();
          });
          if (i < 0) return null;
          return asScalar((own[i] as Rational).mul(partner).div(other[i] as Rational));
        },
      }),
    ],
  }),
  entry({
    id: 'V20_CROSS_MIDDLE_SIGN',
    scene: { template: 'cross_cover' },
    probes: [{ skill: 'v_cross', levels: [1, 2, 3] }],
    variants: [
      on('cross', {
        oneOff: true,
        applies: (data) =>
          cross(...crossFactors(data))[1]
            .abs()
            .compare(Rational.of(2)) >= 0,
        candidate: (data) => {
          const [c1, c2, c3] = cross(...crossFactors(data));
          return asVector(toSurds([c1, c2.neg(), c3]));
        },
      }),
    ],
  }),
  entry({
    id: 'V21_CROSS_ORDER',
    scene: { template: 'cross_cover', mode: 'order' },
    probes: [{ skill: 'v_cross', levels: [1, 2, 3] }],
    variants: [
      on('cross', {
        applies: (data) => nonZeroCount(cross(...crossFactors(data))) >= 2,
        candidate: (data) => {
          const [first, second] = crossFactors(data);
          return asVector(toSurds(cross(second, first)));
        },
      }),
    ],
  }),
  entry({
    id: 'V22_CROSS_COMPONENTWISE',
    scene: { template: 'cross_cover' },
    probes: [{ skill: 'v_cross', levels: [1, 2, 3] }],
    variants: [
      on('cross', {
        candidate: (data) => {
          const [first, second] = crossFactors(data);
          return asVector(toSurds(first.map((part, i) => part.mul(second[i]))));
        },
      }),
    ],
  }),
  entry({
    id: 'V23_TRIANGLE_NO_HALF',
    scene: { template: 'area_volume', mode: 'triangle' },
    probes: [{ skill: 'v_area', levels: [2, 3] }],
    variants: [
      on('area_triangle', {
        candidate: (data) => asSurd(norm(cross(...triangleSides(data)))),
      }),
    ],
  }),
  entry({
    id: 'V24_AREA_DOT',
    scene: { template: 'area_volume' },
    probes: [{ skill: 'v_area', levels: [1, 2, 3] }],
    variants: [
      on('area_parallelogram', {
        applies: ({ u, v }) => !dot(u, v).isZero(),
        candidate: ({ u, v }) => asRational(dot(u, v).abs()),
      }),
      on('area_triangle', {
        applies: (data) => !dot(...triangleSides(data)).isZero(),
        candidate: (data) =>
          asRational(
            dot(...triangleSides(data))
              .abs()
              .div(Rational.of(2)),
          ),
      }),
    ],
  }),
  entry({
    id: 'V25_VOLUME_SIGNED',
    scene: { template: 'area_volume', mode: 'box' },
    probes: [{ skill: 'v_volume', levels: [1, 2] }],
    variants: [
      on('volume', {
        applies: ({ u, v, w }) => triple(u, v, w).sign() < 0,
        candidate: ({ u, v, w }) => asRational(triple(u, v, w)),
      }),
    ],
  }),
  entry({
    id: 'V26_VOLUME_MAG_PRODUCT',
    scene: { template: 'area_volume', mode: 'box' },
    probes: [{ skill: 'v_volume', levels: [1, 2] }],
    variants: [
      on('volume', {
        // A right box gives |u||v||w| exactly, so the mistake would not show.
        applies: ({ u, v, w }) => !isRightBox(u, v, w),
        candidate: ({ u, v, w }) => asSurd(norm(u).mul(norm(v)).mul(norm(w))),
      }),
    ],
  }),
];

function angleAnswer(data: DataOf<'angle'>): number {
  const answer = solve(data);
  if (answer.kind !== 'scalar') throw new Error('angleAnswer: expected degrees');
  return answer.value.n;
}

/** u, v, w pairwise perpendicular (and none zero). */
export function isRightBox(u: Vec, v: Vec, w: Vec): boolean {
  if ([u, v, w].some(isZeroVec)) return false;
  return dot(u, v).isZero() && dot(v, w).isZero() && dot(u, w).isZero();
}

export function catalogEntry(id: MisconceptionId): MisconceptionEntry {
  const found = CATALOG.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`catalogEntry: unknown misconception ${id}`);
  return found;
}

/** Variant names of a misconception, in catalog order. [undefined] when it has no named variants. */
export function variantsOf(id: MisconceptionId): (string | undefined)[] {
  return [...new Set(catalogEntry(id).variants.map((spec) => spec.variant))];
}

/** Levels where this misconception can be probed on this skill, per docs/VECTORS.md §4.1. */
export function probeLevels(skill: SkillId, id: MisconceptionId, variant?: string): Level[] {
  const found = catalogEntry(id);
  const row = found.probes.find((candidate) => candidate.skill === skill);
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
): VectorDiagnostic[] {
  const all: VectorDiagnostic[] = [];
  for (const { id, skills, variants } of CATALOG) {
    if (!skills.includes(skill)) continue;
    for (const spec of variants) {
      if (!spec.applies(body)) continue;
      const answer = spec.candidate(body);
      all.push({
        id,
        ...(spec.variant !== undefined && { variant: spec.variant }),
        answer,
        ...(spec.oneOff && { oneOff: true }),
      });
    }
  }

  const rank = ({ id, variant }: VectorDiagnostic): number => {
    if (id !== target) return 2;
    return targetVariant === undefined || variant === targetVariant ? 0 : 1;
  };
  const ordered = [...all].sort((a, b) => rank(a) - rank(b));

  const kept: VectorDiagnostic[] = [];
  for (const diagnostic of ordered) {
    const clash = kept.find((other) => diagnosticsCollide(other.answer, diagnostic.answer));
    if (clash && clash.id !== target && diagnostic.id !== target) continue;
    kept.push(diagnostic);
  }
  return kept;
}
