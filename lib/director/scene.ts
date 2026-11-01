import { restoreAnswer, storeAnswer } from '@/lib/core/answerJson';
import type { Answer, Classification } from '@/lib/core/types';
import { skillStateOf } from '@/lib/learner/profile';
import type { LearnerProfile } from '@/lib/learner/types';
import { regenerate } from '@/lib/topics/matrix/generators';
import { sceneFor } from '@/lib/topics/matrix/misconceptions';
import {
  conceptScene,
  exampleSeed,
  introScene,
  remediationScene,
  revealScene,
  type SceneSpec,
} from '@/lib/topics/matrix/scenes';
import { SKILLS, skillById, type SkillId } from '@/lib/topics/matrix/skills';
import type { MatrixItem, MisconceptionId } from '@/lib/topics/matrix/types';
import { drawItem, rebuildItem } from './items';
import type { ChosenScene, NextStep, SceneRequest } from './types';

/** Throws if the engine cannot build it. Use `sceneOrNull` wherever a student is waiting. */
export function buildScene(request: SceneRequest): SceneSpec {
  switch (request.kind) {
    case 'intro':
      return introScene(request.unit);
    case 'concept':
      return conceptScene(request.skill, {
        seed: request.seed,
        level: request.level,
        avoid: (request.avoid && rebuildItem(request.avoid)) ?? undefined,
        purpose: request.purpose,
      });
    case 'remediate':
      return remediationScene(
        regenerate(request.ref),
        restoreAnswer(request.answer),
        request.caught,
      );
    case 'reveal':
      return revealScene(regenerate(request.ref));
  }
}

/** A clip is never worth stopping the lesson for: if it cannot be built, the lesson carries on. */
export function sceneOrNull(request: SceneRequest): SceneSpec | null {
  try {
    return buildScene(request);
  } catch {
    return null;
  }
}

export function chosenScene(request: SceneRequest): ChosenScene | undefined {
  const spec = sceneOrNull(request);
  return spec ? { request, template: spec.template, beats: [...spec.beats] } : undefined;
}

/** SPEC §4: before the first item of a new skill, unless the pre-test showed it is known. */
export function needsLeadClip(profile: LearnerProfile, skill: SkillId): boolean {
  const state = skillStateOf(profile, skill);
  return !profile.clipsSeen.includes(skill) && state.attempts.length === 0 && !state.pretestCorrect;
}

/**
 * The first clip seen in a unit is its intro and the rest are concept scenes (SPEC §4), whose example
 * must not be the item that follows. Looking ahead is pure, so nothing is spent here.
 */
export function leadClip(profile: LearnerProfile, step: NextStep): ChosenScene | undefined {
  const { skill } = step;
  const { unit } = skillById(skill);
  const seenInUnit = SKILLS.some(
    (other) => other.unit === unit && profile.clipsSeen.includes(other.id),
  );
  if (!seenInUnit) return chosenScene({ kind: 'intro', unit, skill });
  const upcoming = drawItem(profile, step).item;
  return chosenScene({
    kind: 'concept',
    skill,
    seed: exampleSeed(`${profile.student.id}:lead:${skill}`, 0),
    level: upcoming.ref.difficulty,
    avoid: upcoming.ref,
    purpose: 'concept',
  });
}

/** "ไม่เข้าใจ": the concept scene on a sibling example, a new one on each press (SPEC §4). */
export function helpRequest(item: MatrixItem, nth: number): SceneRequest {
  return {
    kind: 'concept',
    skill: item.ref.skill,
    seed: exampleSeed(`${item.ref.seed}:help`, nth),
    level: item.ref.difficulty,
    avoid: item.ref,
    purpose: 'request',
  };
}

/** What "ดูวิธีทำ" opens: the misconception's own worked scene when it has one, else the plain one. */
export function workedRequest(
  item: MatrixItem,
  answer: Answer,
  classification: Classification,
): SceneRequest {
  if (classification.type === 'misconception') {
    const id = classification.id as MisconceptionId;
    const { variant } = classification;
    if (sceneFor(id, { kind: item.kind, variant }).template === 'worked_solution') {
      return {
        kind: 'remediate',
        ref: item.ref,
        answer: storeAnswer(answer),
        caught: { id, variant },
      };
    }
  }
  return { kind: 'reveal', ref: item.ref };
}
