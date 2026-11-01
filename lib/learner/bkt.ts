import { CONFIG } from '@/lib/config';
import type { Item } from '@/lib/core/types';
import type { LearnerConfig } from './types';

/** G of SPEC §7.1: 1/k for a choice with k options, and a small constant for a typed answer. */
export function guessRate(
  { kind, options }: Pick<Item, 'kind' | 'options'>,
  config: LearnerConfig = CONFIG,
): number {
  return kind === 'choice' && options?.length ? 1 / options.length : config.bkt.pGuessEntry;
}

/** One step of Bayesian Knowledge Tracing (Corbett & Anderson, 1994), as written in SPEC §7.1. */
export function updateKnown(
  pKnown: number,
  correct: boolean,
  guess: number,
  config: LearnerConfig = CONFIG,
): number {
  const { pSlip, pTransit } = config.bkt;
  const known = pKnown * (correct ? 1 - pSlip : pSlip);
  const unknown = (1 - pKnown) * (correct ? guess : 1 - guess);
  const posterior = known / (known + unknown);
  return posterior + (1 - posterior) * pTransit;
}
