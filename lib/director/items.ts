import { deriveSeed } from '@/lib/core/prng';
import { levelOf } from '@/lib/learner/profile';
import type { LearnerProfile } from '@/lib/learner/types';
import { generate, regenerate } from '@/lib/topics/matrix/generators';
import type { GenerateRequest, MatrixItem, MatrixItemRef } from '@/lib/topics/matrix/types';
import type { NextStep } from './types';

/** A generator failure is a bug, but one bad seed must not stop a class, so try the next few. */
const SEEDS_TO_TRY = 5;

/** Null when the item cannot be rebuilt, which means its generator version has gone. */
export function rebuildItem(ref: MatrixItemRef): MatrixItem | null {
  try {
    return regenerate(ref);
  } catch {
    return null;
  }
}

export function currentItem(profile: Pick<LearnerProfile, 'current'>): MatrixItem | null {
  return profile.current ? rebuildItem(profile.current.ref) : null;
}

export interface Draw {
  item: MatrixItem;
  /** The profile's next counter once this item is really issued. */
  counter: number;
  /** A probe could not be built and a plain item took its place. */
  fellBack: boolean;
}

/**
 * The item this step gives right now. Pure: until a candidate is chosen the counter stays put, so the
 * numbers of the next item do not depend on how many candidates were looked at (SPEC §6).
 */
export function drawItem(
  profile: Pick<LearnerProfile, 'student' | 'counter' | 'skills'>,
  { skill, level, target, targetVariant }: NextStep,
  make: (request: GenerateRequest) => MatrixItem = generate,
): Draw {
  let failure: unknown;
  for (let offset = 0; offset < SEEDS_TO_TRY; offset += 1) {
    const counter = profile.counter + offset;
    const seed = deriveSeed(profile.student.id, counter);
    try {
      const item = make({ skill, difficulty: level, seed, target, targetVariant });
      return { item, counter: counter + 1, fellBack: false };
    } catch (error) {
      failure = error;
    }
    if (target === undefined) continue;
    // .claude/rules/director.md: a probe that cannot be built becomes item(s, L), and never an error.
    try {
      const item = make({ skill, difficulty: levelOf(profile, skill), seed });
      return { item, counter: counter + 1, fellBack: true };
    } catch (error) {
      failure = error;
    }
  }
  throw failure;
}
