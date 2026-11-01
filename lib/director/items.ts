import { deriveSeed } from '@/lib/core/prng';
import { levelOf } from '@/lib/learner/profile';
import type { LearnerProfile } from '@/lib/learner/types';
import { generate, regenerate } from '@/lib/topics/matrix/generators';
import type { GenerateRequest, MatrixItem, MatrixItemRef } from '@/lib/topics/matrix/types';
import type { NextStep } from './types';

/** A generator failure is a bug, but one bad seed must not stop a class, so try the next few. */
const SEEDS_TO_TRY = 5;

/** How many of a student's latest items a new one must differ from. */
export const RECENT_ITEMS = 30;

/** Forms with few possible items run out, and then an item may come back. */
const TRIES_FOR_A_NEW_ITEM = 12;

/** Short, since a profile keeps thirty of these, and pure, since the server draws the same item. */
export function fingerprintOf(item: MatrixItem): string {
  return deriveSeed(JSON.stringify(item.data), 0).toString(36);
}

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
  profile: Pick<LearnerProfile, 'student' | 'counter' | 'skills' | 'recentItems'>,
  { skill, level, target, targetVariant }: NextStep,
  make: (request: GenerateRequest) => MatrixItem = generate,
): Draw {
  const recent = profile.recentItems ?? [];
  let failure: unknown;
  let seenBefore: Draw | null = null;
  for (let offset = 0; offset < TRIES_FOR_A_NEW_ITEM; offset += 1) {
    if (seenBefore === null && offset >= SEEDS_TO_TRY) break;
    const counter = profile.counter + offset;
    const seed = deriveSeed(profile.student.id, counter);
    try {
      const item = make({ skill, difficulty: level, seed, target, targetVariant });
      const draw = { item, counter: counter + 1, fellBack: false };
      if (!recent.includes(fingerprintOf(item))) return draw;
      seenBefore ??= draw;
      continue;
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
  if (seenBefore) return seenBefore;
  throw failure;
}
