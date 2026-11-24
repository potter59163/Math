import { restoreAnswer, storeAnswer } from '@/lib/core/answerJson';
import { exampleSeed } from '@/lib/core/prng';
import type { Answer, Classification, Item } from '@/lib/core/types';
import { skillStateOf } from '@/lib/learner/profile';
import type { LearnerProfile } from '@/lib/learner/types';
import { packOf, packOfSkill, skillOf } from '@/lib/topics';
import type { SceneSpec, SkillId } from '@/lib/topics/types';
import { drawItem, rebuildItem } from './items';
import type { ChosenScene, NextStep, SceneRequest } from './types';

/** Throws if the engine cannot build it. Use `sceneOrNull` wherever a student is waiting. */
export function buildScene(request: SceneRequest): SceneSpec {
  switch (request.kind) {
    case 'intro':
      return packOfSkill(request.skill).scenes.intro(request.unit, {
        seed: request.seed,
        theme: request.theme,
      });
    case 'concept':
      return packOfSkill(request.skill).scenes.concept(request.skill, {
        seed: request.seed,
        level: request.level,
        avoid: (request.avoid && rebuildItem(request.avoid)) ?? undefined,
        purpose: request.purpose,
      });
    case 'remediate': {
      const pack = packOf(request.ref.topic);
      return pack.scenes.remediate(
        pack.regenerate(request.ref),
        restoreAnswer(request.answer),
        request.caught,
        request.theme,
      );
    }
    case 'reveal': {
      const pack = packOf(request.ref.topic);
      return pack.scenes.reveal(pack.regenerate(request.ref));
    }
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

/** The clip as this student gets it: the tutor's captions over the template's, beat by beat. */
export function sceneOfChosen({ request, narration }: ChosenScene): SceneSpec | null {
  const spec = sceneOrNull(request);
  if (!spec || !narration) return spec;
  return { ...spec, captions: { ...spec.captions, ...narration } } as SceneSpec;
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
  const { unit } = skillOf(skill);
  const seenInUnit = packOfSkill(skill).skills.some(
    (other) => other.unit === unit && profile.clipsSeen.includes(other.id),
  );
  if (!seenInUnit) {
    return chosenScene({
      kind: 'intro',
      unit,
      skill,
      seed: exampleSeed(`${profile.student.id}:intro:${unit}`, 0),
      ...(profile.student.theme && { theme: profile.student.theme }),
    });
  }
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
export function helpRequest(item: Item, nth: number): SceneRequest {
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
  item: Item,
  answer: Answer,
  classification: Classification,
): SceneRequest {
  if (classification.type === 'misconception') {
    const { id, variant } = classification;
    if (packOf(item.ref.topic).scenes.hasWorkedScene({ id, variant }, item.kind)) {
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
