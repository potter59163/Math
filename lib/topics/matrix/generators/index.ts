import { CONFIG } from '@/lib/config';
import { createRng } from '@/lib/core/prng';
import type { Level } from '@/lib/core/types';
import { buildDiagnostics, probeLevels } from '../misconceptions';
import { validateMatrixItem } from '../rules';
import { skillById, type SkillId } from '../skills';
import type {
  GenerateRequest,
  MatrixData,
  MatrixItem,
  MatrixItemRef,
  Probe,
  SkillGenerator,
} from '../types';
import { addsub } from './addsub';
import { det2 } from './det2';
import { det3 } from './det3';
import { detProps } from './det_props';
import { dim } from './dim';
import { indexSkill } from './index_skill';
import { inv2 } from './inv2';
import { invertible } from './invertible';
import { mult } from './mult';
import { multDefined } from './mult_defined';
import { multNoncomm } from './mult_noncomm';
import { scalar } from './scalar';
import { transpose } from './transpose';

const GENERATORS: Record<SkillId, SkillGenerator> = {
  dim,
  index: indexSkill,
  transpose,
  addsub,
  scalar,
  mult_defined: multDefined,
  mult,
  mult_noncomm: multNoncomm,
  det2,
  det3,
  det_props: detProps,
  invertible,
  inv2,
};

export const MAX_TRIES = 50;

interface AssembleOptions extends Probe {
  seed?: number;
}

/** Builds the item for known numbers. Diagnostics always come from the catalog. */
export function assemble(
  skill: SkillId,
  level: Level,
  data: MatrixData,
  { seed = 0, target, targetVariant }: AssembleOptions = {},
): MatrixItem {
  const body = GENERATORS[skill].body(data, level);
  const ref: MatrixItemRef = {
    topic: 'matrix',
    skill,
    difficulty: level,
    seed,
    ...(target && { target }),
    ...(targetVariant && { targetVariant }),
    gv: CONFIG.generatorVersion,
  };
  return { ref, ...body, diagnostics: buildDiagnostics(skill, body, target, targetVariant) };
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

/** Same as generate, and also reports how many draws it took. */
export function generateDetailed(request: GenerateRequest): { item: MatrixItem; tries: number } {
  checkRequest(request);
  const { skill, difficulty, seed, target, targetVariant } = request;
  for (let tries = 1; tries <= MAX_TRIES; tries += 1) {
    const rng = createRng(seed + tries - 1);
    const data = GENERATORS[skill].sample(rng, difficulty, { target, targetVariant });
    const item = assemble(skill, difficulty, data, { seed, target, targetVariant });
    if (validateMatrixItem(item).ok) return { item, tries };
  }
  throw new Error(`generate: no valid ${skill} L${difficulty} item from seed ${seed}`);
}

/** Resamples with seed, seed+1, … until validateItem passes. Throwing means a generator bug. */
export function generate(request: GenerateRequest): MatrixItem {
  return generateDetailed(request).item;
}

/** Rebuilds an item from its ref. A ref from another generator version cannot be reproduced. */
export function regenerate(ref: MatrixItemRef): MatrixItem {
  if (ref.gv !== CONFIG.generatorVersion) {
    throw new Error(`regenerate: ref is gv ${ref.gv}, engine is gv ${CONFIG.generatorVersion}`);
  }
  return generate({
    skill: ref.skill,
    difficulty: ref.difficulty,
    seed: ref.seed,
    target: ref.target,
    targetVariant: ref.targetVariant,
  });
}
