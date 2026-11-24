import { createRng, type Rng } from '@/lib/core/prng';
import type { Level } from '@/lib/core/types';
import { buildDiagnostics, catalogEntry, probeLevels } from '../misconceptions';
import { limitProblem, validateVectorItem } from '../rules';
import { skillById, type SkillId } from '../skills';
import type {
  GenerateRequest,
  Probe,
  SkillGenerator,
  VectorData,
  VectorItem,
  VectorItemRef,
} from '../types';
import { angle } from './angle';
import { area } from './area';
import { cross } from './cross';
import { dot } from './dot';
import { geom } from './geom';
import { linear } from './linear';
import { magnitude } from './magnitude';
import { parallel } from './parallel';
import { perp } from './perp';
import { points } from './points';
import { quantity } from './quantity';
import { unit } from './unit';
import { volume } from './volume';

/**
 * The vector pack's own generator version (docs/VECTORS.md §6.1), apart from the matrix one, so a
 * change here never invalidates a stored matrix item. Bump it on any generator change.
 */
export const VECTOR_GENERATOR_VERSION = 1;

const GENERATORS: Record<SkillId, SkillGenerator> = {
  v_quantity: quantity,
  v_geom: geom,
  v_points: points,
  v_linear: linear,
  v_parallel: parallel,
  v_magnitude: magnitude,
  v_unit: unit,
  v_dot: dot,
  v_angle: angle,
  v_perp: perp,
  v_cross: cross,
  v_area: area,
  v_volume: volume,
};

export const MAX_TRIES = 50;

/** Draws per try before settling: numbers outside the limits, or a probe that cannot show, are redrawn. */
const MAX_DRAWS = 400;

interface AssembleOptions extends Probe {
  seed?: number;
}

/** Builds the item for known numbers. Diagnostics always come from the catalog. */
export function assemble(
  skill: SkillId,
  level: Level,
  data: VectorData,
  { seed = 0, target, targetVariant }: AssembleOptions = {},
): VectorItem {
  const body = GENERATORS[skill].body(data, level);
  const ref: VectorItemRef = {
    topic: 'vector',
    skill,
    difficulty: level,
    seed,
    ...(target && { target }),
    ...(targetVariant && { targetVariant }),
    gv: VECTOR_GENERATOR_VERSION,
  };
  return { ref, ...body, diagnostics: buildDiagnostics(skill, body, target, targetVariant) };
}

function targetShows(data: VectorData, { target, targetVariant }: Probe): boolean {
  if (target === undefined) return true;
  return catalogEntry(target).variants.some(
    (spec) =>
      (targetVariant === undefined || spec.variant === targetVariant) && spec.applies({ data }),
  );
}

/**
 * One draw of numbers that fit the level's limits (rule 5) and, for a probe, let the target show.
 * The draws come from the same seeded stream, so they are as reproducible as the first one.
 */
function draw(skill: SkillId, rng: Rng, level: Level, probe: Probe): VectorData {
  let data = GENERATORS[skill].sample(rng, level, probe);
  for (let i = 1; i < MAX_DRAWS; i += 1) {
    if (limitProblem(data) === null && targetShows(data, probe)) break;
    data = GENERATORS[skill].sample(rng, level, probe);
  }
  return data;
}

function checkRequest({ skill, difficulty, seed, target, targetVariant }: GenerateRequest): void {
  if (!Number.isSafeInteger(seed)) throw new Error(`generate: bad seed ${seed}`);
  if (difficulty > skillById(skill).maxLevel) {
    throw new Error(`generate: ${skill} has no L${difficulty}`);
  }
  if (targetVariant !== undefined && target === undefined) {
    throw new Error('generate: targetVariant needs a target');
  }
  if (target === undefined) return;
  if (!probeLevels(skill, target, targetVariant).includes(difficulty)) {
    const name = targetVariant === undefined ? target : `${target}:${targetVariant}`;
    throw new Error(
      `generate: ${name} cannot be probed on ${skill} L${difficulty}; use probeLevel`,
    );
  }
}

/** Same as generate, and also reports how many tries validateItem needed. */
export function generateDetailed(request: GenerateRequest): { item: VectorItem; tries: number } {
  checkRequest(request);
  const { skill, difficulty, seed, target, targetVariant } = request;
  for (let tries = 1; tries <= MAX_TRIES; tries += 1) {
    const rng = createRng(seed + tries - 1);
    const data = draw(skill, rng, difficulty, { target, targetVariant });
    const item = assemble(skill, difficulty, data, { seed, target, targetVariant });
    if (validateVectorItem(item).ok) return { item, tries };
  }
  throw new Error(`generate: no valid ${skill} L${difficulty} item from seed ${seed}`);
}

/** Resamples with seed, seed+1, … until validateItem passes. Throwing means a generator bug. */
export function generate(request: GenerateRequest): VectorItem {
  return generateDetailed(request).item;
}

/** Rebuilds an item from its ref. A ref from another generator version cannot be reproduced. */
export function regenerate(ref: VectorItemRef): VectorItem {
  if (ref.gv !== VECTOR_GENERATOR_VERSION) {
    throw new Error(`regenerate: ref is gv ${ref.gv}, engine is gv ${VECTOR_GENERATOR_VERSION}`);
  }
  return generate({
    skill: ref.skill,
    difficulty: ref.difficulty,
    seed: ref.seed,
    target: ref.target,
    targetVariant: ref.targetVariant,
  });
}
