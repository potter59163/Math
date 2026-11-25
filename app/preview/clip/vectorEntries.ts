import { th } from '@/lib/content/th';
import { thVector } from '@/lib/content/th.vector';
import { fillTokens } from '@/lib/core/tokens';
import type { SceneSpec } from '@/lib/topics/types';
import { generate as generateVector } from '@/lib/topics/vector/generators';
import {
  VECTOR_UNITS,
  conceptScene as vectorConcept,
  introScene as vectorIntro,
  revealScene as vectorReveal,
} from '@/lib/topics/vector/scenes';
import { VECTOR_SCENE_COMBOS, vectorCaughtExample } from '@/lib/topics/vector/scenes/catalog';
import { SKILLS as VECTOR_SKILLS } from '@/lib/topics/vector/skills';

// Every vector clip, for /preview/clip and its stills: each unit's intro, each skill's concept clip and
// worked solution, and each mistake at every level it can be probed at (VECTORS §4.1).

export interface Entry {
  key: string;
  title: string;
  spec: SceneSpec;
}

const SEEDS_TO_TRY = 200;

/** Every vector mistake at every level it can be probed at (VECTORS §4.1), on the first seed that shows it. */
function vectorCaughtEntries(seed: number): Entry[] {
  const copy = th.clip.preview;
  return VECTOR_SCENE_COMBOS.flatMap((combo) => {
    for (let nth = seed; nth < seed + SEEDS_TO_TRY; nth += 1) {
      const caught = vectorCaughtExample(combo, nth);
      if (caught) {
        return [
          {
            key: `${combo.id}:L${combo.level}`,
            title: `${thVector.misconceptionNames[combo.id]} · ${fillTokens(copy.level, { n: String(combo.level) })}`,
            spec: caught.spec as SceneSpec,
          },
        ];
      }
    }
    return [];
  });
}

export function vectorSections(seed: number): { title: string; entries: Entry[] }[] {
  const copy = th.clip.preview;
  return [
    {
      title: copy.intro,
      entries: VECTOR_UNITS.map((unit) => ({
        key: `v_intro:${unit}`,
        title: `${thVector.unitBadges[unit]} ${thVector.units[unit]}`,
        spec: vectorIntro(unit, { seed }) as SceneSpec,
      })),
    },
    {
      title: copy.concept,
      entries: VECTOR_SKILLS.map(({ id }) => ({
        key: `v_concept:${id}`,
        title: thVector.skills[id],
        spec: vectorConcept(id, { seed, level: 1 }) as SceneSpec,
      })),
    },
    { title: copy.remediate, entries: vectorCaughtEntries(seed) },
    {
      title: copy.worked,
      entries: VECTOR_SKILLS.map(({ id }) => ({
        key: `v_worked:${id}`,
        title: thVector.skills[id],
        spec: vectorReveal(generateVector({ skill: id, difficulty: 2, seed })) as SceneSpec,
      })),
    },
  ];
}
