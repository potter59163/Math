import { exampleSeed } from '@/lib/core/prng';
import { answersEqual } from '@/lib/core/classify';
import type { Answer, Item, ItemKind, Level } from '@/lib/core/types';
import type { SceneSpecOf } from '@/lib/topics/matrix/scenes/types';
import type { ConceptSceneOptions, TopicPack } from '@/lib/topics/types';
import { generate } from '../generators';
import { sceneFor } from '../misconceptions';
import { isZeroVec, sub } from '../ops';
import { linearVec } from '../solve';
import { type SkillId } from '../skills';
import type { MisconceptionId, Vec, VectorItem } from '../types';
import { angleScene } from './angleFan';
import { areaScene } from './areaVolume';
import { arrowChainScene } from './arrowChain';
import { componentScene } from './componentSteps';
import { crossScene } from './crossCover';
import { dotScene } from './dotPairs';
import { magnitudeScene } from './magnitudeBox';
import { parallelScene } from './parallelScale';
import { quantitySortScene } from './quantitySort';
import type { ScenePurpose, VectorTemplateScene } from './types';
import { unitScene } from './unitShrink';
import { vectorWorkedScene } from './workedSolution';

// The clips of the vector pack (docs/VECTORS.md §5), in the shape TopicPack['scenes'] asks for. A clip
// about a mistake plays the student's own closed item. Intros and concept clips play an example from
// the generator, drawn with exampleSeed so that they never move the student's own items (SPEC §6).

export type VectorScene = VectorTemplateScene | SceneSpecOf<'worked_solution'>;

export interface VectorCaught {
  id: MisconceptionId;
  variant?: string;
}

/** The clip for this item, in compare mode when a student's answer and mistake are given. */
function sceneOf(
  item: Pick<VectorItem, 'data' | 'correct'>,
  purpose: ScenePurpose,
  studentAnswer?: Answer,
  caught?: MisconceptionId,
): VectorScene {
  const { data } = item;
  const shared = { purpose, studentAnswer, caught };
  switch (data.form) {
    case 'quantity_kind':
      return quantitySortScene({ data, purpose, studentAnswer });
    case 'figure_equal':
    case 'figure_expr':
      return arrowChainScene({ data, ...shared });
    case 'points':
      return componentScene({ mode: 'points', A: data.A, B: data.B, purpose, studentAnswer });
    case 'linear':
      return componentScene({
        mode: 'linear',
        terms: data.terms,
        notation: data.notation,
        ...shared,
      });
    case 'parallel':
      return parallelScene({ data, purpose, studentAnswer });
    case 'magnitude':
    case 'magnitude_combo':
    case 'distance':
      return magnitudeScene({ data, ...shared });
    case 'unit':
    case 'scaled_unit':
    case 'direction_cosines':
      return unitScene({ data, ...shared });
    case 'dot':
    case 'perp':
      return dotScene({ data, purpose, studentAnswer } as Parameters<typeof dotScene>[0]);
    case 'dot_polar':
      return dotScene({ data, ...shared });
    case 'cos_angle':
    case 'angle':
      return angleScene({ data, ...shared });
    case 'cross':
      return crossScene({ data, ...shared });
    case 'area_parallelogram':
    case 'area_triangle':
    case 'volume':
      return areaScene({ data, ...shared });
    // Forms no template draws: the fourth vertex and the (u + v) ⊥ (u − v) property.
    case 'fourth_vertex':
    case 'perp_property':
      return vectorWorkedScene(item, purpose, studentAnswer);
  }
}

const MAX_EXAMPLE_TRIES = 50;

/** Teaches the concept without showing this item, its numbers or its answer (SPEC §4). */
function givesAway(example: VectorItem, open: VectorItem | undefined): boolean {
  if (!open) return false;
  if (JSON.stringify(example.data) === JSON.stringify(open.data)) return true;
  return open.kind !== 'choice' && answersEqual(example.correct, open.correct);
}

const zeros = (v: readonly { isZero(): boolean }[]) => v.filter((part) => part.isZero()).length;

const tooTall = (v: Vec): boolean =>
  v.length === 3 && v[2].abs().compare(v[0].abs().add(v[1].abs())) > 0;

/** An example that cannot show what its clip is about, though a student could still work it. */
export function cannotTeach({ data }: Pick<VectorItem, 'data'>): boolean {
  switch (data.form) {
    case 'points':
      return zeros(sub(data.B, data.A)) > 0;
    case 'parallel': {
      const known = data.u.findIndex(
        (part, i) => typeof part !== 'string' && typeof data.v[i] !== 'string',
      );
      const [a, b] = [data.u[known], data.v[known]];
      return typeof a === 'string' || typeof b === 'string' || a.abs().equals(b.abs());
    }
    // A zero side flattens the box, which leaves nothing to take the diagonal of, and a box much
    // taller than its floor hides the first step of Pythagoras.
    case 'magnitude':
      return zeros(data.v) > 0 || tooTall(data.v);
    case 'distance':
      return zeros(sub(data.B, data.A)) > 0 || tooTall(sub(data.B, data.A));
    case 'magnitude_combo':
      return zeros(linearVec(data.terms)) > 0;
    case 'dot':
      return zeros(data.u.map((part, i) => part.mul(data.v[i]))) > 0;
    case 'cross':
      return zeros(data.u) > 1 || zeros(data.v) > 1;
    case 'volume':
      return isZeroVec(data.u) || zeros(data.u) > 1;
    default:
      return false;
  }
}

/** The level a concept clip is drawn at: the one that shows its idea best. */
function conceptLevel(skill: SkillId, level: Level): Level {
  switch (skill) {
    // L3 asks for a point or uses the property, which no template draws.
    case 'v_points':
    case 'v_perp':
    // L3 writes three terms in i, j, k, which does not fit the clip's length.
    case 'v_linear':
      return Math.min(level, 2) as Level;
    // L1 has two zeros in each vector, which leaves most of the table empty.
    case 'v_cross':
      return Math.max(level, 2) as Level;
    default:
      return level;
  }
}

/** The generator's sibling for a concept clip (SCENES §5.1). */
export function conceptExample(
  skill: SkillId,
  { seed, level = 1, avoid }: { seed: number; level?: Level; avoid?: VectorItem },
): VectorItem {
  for (let nth = 0; nth < MAX_EXAMPLE_TRIES; nth += 1) {
    const example = generate({
      skill,
      difficulty: conceptLevel(skill, level),
      seed: exampleSeed(seed, nth),
    });
    if (!cannotTeach(example) && !givesAway(example, avoid)) return example;
  }
  throw new Error(`conceptExample: no usable example of ${skill} from seed ${seed}`);
}

export function conceptScene(
  skill: SkillId,
  {
    purpose = 'concept',
    ...options
  }: { seed: number; level?: Level; avoid?: VectorItem; purpose?: 'concept' | 'request' },
): VectorScene {
  return sceneOf(conceptExample(skill, options), purpose);
}

/** What each unit's first clip is drawn from (VECTORS §5). */
const INTRO: Record<number, { skill: SkillId; level: Level; target?: MisconceptionId }> = {
  // The V01 probe has a vector quantity and the scalar it is mixed up with side by side.
  11: { skill: 'v_quantity', level: 1, target: 'V01_QUANTITY_MIX' },
  12: { skill: 'v_points', level: 2 },
  13: { skill: 'v_magnitude', level: 2 },
  14: { skill: 'v_dot', level: 1 },
  15: { skill: 'v_cross', level: 2 },
};

export const VECTOR_UNITS = [11, 12, 13, 14, 15] as const;

/** The default when no student is given, as for /preview/clip without a seed. */
const INTRO_SEED = 20261124;

export function introExample(unit: number, seed = INTRO_SEED): VectorItem {
  const recipe = INTRO[unit];
  if (!recipe) throw new Error(`introScene: unknown vector unit ${unit}`);
  for (let nth = 0; nth < MAX_EXAMPLE_TRIES; nth += 1) {
    const example = generate({
      skill: recipe.skill,
      difficulty: recipe.level,
      seed: exampleSeed(`intro:${seed}`, unit * 100 + nth),
      target: recipe.target,
    });
    if (!cannotTeach(example)) return example;
  }
  throw new Error(`introScene: no usable example for unit ${unit}`);
}

/** The first clip of a unit, at most 40 seconds (SCENES §5). Vector intros tell no story. */
export function introScene(unit: number, { seed }: { seed?: number } = {}): VectorScene {
  return sceneOf(introExample(unit, seed), 'intro');
}

/** The clip for a caught misconception, opening on what the student answered. */
export function remediationScene(
  item: VectorItem,
  answer: Answer,
  caught: VectorCaught,
): VectorScene {
  return sceneOf(item, 'remediate', answer, caught.id);
}

/** "ดูวิธีทำ" (SPEC §4). The item is closed, so its own numbers are fine. */
export function revealScene(item: Pick<VectorItem, 'data' | 'correct'>): VectorScene {
  return vectorWorkedScene(item, 'reveal');
}

function asVector(item: Item): VectorItem {
  if (item.ref.topic !== 'vector') throw new Error(`vector scenes: got a ${item.ref.topic} item`);
  return item as VectorItem;
}

/** TopicPack['scenes'] of the vector pack. */
export const vectorScenes: TopicPack['scenes'] = {
  intro: (unit, { seed }) => introScene(unit, { seed }),
  concept: (skill, { avoid, ...options }: ConceptSceneOptions) =>
    conceptScene(skill as SkillId, { ...options, avoid: avoid && asVector(avoid) }),
  remediate: (item, answer, caught) =>
    remediationScene(asVector(item), answer, {
      id: caught.id as MisconceptionId,
      variant: caught.variant,
    }),
  reveal: (item) => revealScene(asVector(item)),
  hasWorkedScene: ({ id, variant }, kind: ItemKind) =>
    sceneFor(id as MisconceptionId, { kind, variant }).template === 'worked_solution',
};

export { vectorWorkedScene };
