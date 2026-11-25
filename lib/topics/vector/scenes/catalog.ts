import { classify } from '@/lib/core/classify';
import type { Answer, Level } from '@/lib/core/types';
import { generate } from '../generators';
import { CATALOG, probeLevels, variantsOf } from '../misconceptions';
import type { SkillId } from '../skills';
import type { MisconceptionId, VectorItem } from '../types';
import { remediationScene, type VectorCaught, type VectorScene } from '.';

// Walks every clip a caught vector misconception can play. For tests and /preview/clip, not students.

export interface VectorSceneCombo {
  id: MisconceptionId;
  skill: SkillId;
  level: Level;
  variant?: string;
}

/** Every misconception × variant × level of docs/VECTORS.md §4.1. */
export const VECTOR_SCENE_COMBOS: VectorSceneCombo[] = CATALOG.flatMap((entry) =>
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

export interface VectorCaughtExample {
  item: VectorItem;
  answer: Answer;
  caught: VectorCaught;
  spec: VectorScene;
}

/** Builds the probe, answers it the way this misconception would, and builds the clip for that. */
export function vectorCaughtExample(
  { id, skill, level, variant }: VectorSceneCombo,
  seed: number,
): VectorCaughtExample | null {
  const item = generate({ skill, difficulty: level, seed, target: id, targetVariant: variant });
  const diagnostic = item.diagnostics.find(
    (candidate) => candidate.id === id && (variant === undefined || candidate.variant === variant),
  );
  if (!diagnostic || diagnostic.answer.kind === 'any_matrix') return null;
  const answer = diagnostic.answer;
  const classification = classify(item, answer);
  if (classification.type !== 'misconception') return null;
  const caught = { id: classification.id as MisconceptionId, variant: classification.variant };
  return { item, answer, caught, spec: remediationScene(item, answer, caught) };
}
