import { createRng, type Rng } from '@/lib/core/prng';
import type { Answer } from '@/lib/core/types';
import type { ChosenScene } from '@/lib/director/types';
import { catalogEntry } from '@/lib/topics/matrix/misconceptions';
import type { MatrixItem, MisconceptionId } from '@/lib/topics/matrix/types';
import { misconceptionAnswer, randomAnswer, slipAnswer } from './answers';

// Simulated learners (PLAN Phase 4). Deterministic: every student draws from its own seed. These test
// the system. Their results are never evidence about real students.

export interface SimStudent {
  label: string;
  answer(item: MatrixItem): Answer;
  /** Every clip that plays for this student. */
  onScene(scene: ChosenScene): void;
}

const ignoreScene = (): void => {};

function chance(rng: Rng, p: number): boolean {
  return rng.next() / 2 ** 32 < p;
}

export function perfect(): SimStudent {
  return { label: 'perfect', answer: (item) => item.correct, onScene: ignoreScene };
}

/** Knows the skill, and slips with probability p. */
export function slipper(p: number, seed: number): SimStudent {
  const rng = createRng(seed);
  return {
    label: `slipper(${p})`,
    answer: (item) => (chance(rng, p) ? slipAnswer(item) : item.correct),
    onScene: ignoreScene,
  };
}

function isAboutBug({ request }: ChosenScene, id: MisconceptionId): boolean {
  if (request.kind === 'remediate') return request.caught.id === id;
  return request.kind === 'reveal' && catalogEntry(id).skills.includes(request.ref.skill);
}

/**
 * Answers by the candidate of `id` wherever an item can show it, and is right otherwise. After a scene
 * on this topic the bug goes away with probability fixProb.
 */
export function buggy(id: MisconceptionId, fixProb: number, seed: number): SimStudent {
  const rng = createRng(seed);
  let fixed = false;
  return {
    label: `buggy(${fixProb})`,
    answer: (item) =>
      (fixed ? null : misconceptionAnswer(item, id, undefined, rng)) ?? item.correct,
    onScene: (scene) => {
      if (!fixed && isAboutBug(scene, id) && chance(rng, fixProb)) fixed = true;
    },
  };
}

export function randomStudent(seed: number): SimStudent {
  const rng = createRng(seed);
  return {
    label: 'random',
    answer: (item) => randomAnswer(item, rng),
    onScene: ignoreScene,
  };
}

/**
 * The student assumed by the table in RESEARCH §3.1: right with probability `rate`, and half of the
 * wrong answers are misconceptions, whichever ones the item can show.
 */
export function planned(rate: number, seed: number): SimStudent {
  const rng = createRng(seed);
  const wrong = (item: MatrixItem): Answer => {
    if (item.diagnostics.length > 0 && chance(rng, 0.5)) {
      const { id, variant } = rng.pick(item.diagnostics);
      return misconceptionAnswer(item, id, variant, rng) ?? slipAnswer(item);
    }
    return slipAnswer(item);
  };
  return {
    label: `${Math.round(rate * 100)}% right`,
    answer: (item) => (chance(rng, rate) ? item.correct : wrong(item)),
    onScene: ignoreScene,
  };
}
