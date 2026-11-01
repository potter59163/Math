import { classify } from '@/lib/core/classify';
import { createRng } from '@/lib/core/prng';
import { Rational } from '@/lib/core/rational';
import type { Answer, Level } from '@/lib/core/types';
import { generate } from '../generators';
import { CATALOG, probeLevels, variantsOf } from '../misconceptions';
import type { SkillId } from '../skills';
import type { MatrixItem, MisconceptionId } from '../types';
import { remediationScene, type Caught } from '.';
import type { SceneSpec } from './types';

// Walks every scene a caught misconception can play. For tests and /dev/scenes, not for students.

export interface SceneCombo {
  id: MisconceptionId;
  skill: SkillId;
  level: Level;
  variant?: string;
}

/** Every ★ misconception × variant × level it can be probed at (MISCONCEPTIONS §4.1). */
export const SCENE_COMBOS: SceneCombo[] = CATALOG.flatMap((entry) =>
  entry.probes.flatMap((row) =>
    variantsOf(entry.id).flatMap((variant) =>
      probeLevels(row.skill, entry.id, variant).map((level) => ({
        id: entry.id,
        skill: row.skill,
        level,
        variant,
      })),
    ),
  ),
);

/** M04 matches any matrix, so a student is simulated with a random one (MISCONCEPTIONS §3). */
function randomMatrix(item: MatrixItem): Answer {
  const rng = createRng(item.ref.seed);
  const value = Array.from({ length: item.grid!.rows }, () =>
    Array.from({ length: item.grid!.cols }, () => Rational.of(rng.int(-9, 9))),
  );
  return { kind: 'matrix', value };
}

export interface CaughtExample {
  item: MatrixItem;
  answer: Answer;
  caught: Caught;
  spec: SceneSpec;
}

/** Builds the probe, answers it the way this misconception would, and builds the scene for that. */
export function caughtExample(
  { id, skill, level, variant }: SceneCombo,
  seed: number,
): CaughtExample | null {
  const item = generate({ skill, difficulty: level, seed, target: id, targetVariant: variant });
  const diagnostic = item.diagnostics.find(
    (candidate) => candidate.id === id && (variant === undefined || candidate.variant === variant),
  );
  if (!diagnostic) return null;
  const answer = diagnostic.answer.kind === 'any_matrix' ? randomMatrix(item) : diagnostic.answer;
  const classification = classify(item, answer);
  if (classification.type !== 'misconception') return null;
  const caught = { id: classification.id as MisconceptionId, variant: classification.variant };
  return { item, answer, caught, spec: remediationScene(item, answer, caught) };
}
