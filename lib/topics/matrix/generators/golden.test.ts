import { describe, expect, it } from 'vitest';
import { CATALOG, probeLevels } from '../misconceptions';
import { SKILLS, levelsOf } from '../skills';
import type { GenerateRequest } from '../types';
import { generate, regenerate } from '.';

const SEEDS = [1, 20261113, 4294967295];

const REQUESTS: GenerateRequest[] = [
  ...SKILLS.flatMap(({ id }) =>
    levelsOf(id).flatMap((difficulty) => SEEDS.map((seed) => ({ skill: id, difficulty, seed }))),
  ),
  ...CATALOG.flatMap((entry) =>
    entry.skills.flatMap((skill) =>
      probeLevels(skill, entry.id).map((difficulty) => ({
        skill,
        difficulty,
        seed: 20261113,
        target: entry.id,
      })),
    ),
  ),
];

describe('golden seeds', () => {
  // If this fails, generated numbers changed. Stored ItemRefs would no longer rebuild the same items,
  // so bump generatorVersion in lib/config.ts, then refresh with `npx vitest run -u`.
  it('generate the same items as when these were recorded', async () => {
    const lines = REQUESTS.map((request) => JSON.stringify(generate(request)));
    await expect(`${lines.join('\n')}\n`).toMatchFileSnapshot('./__snapshots__/golden-items.snap');
  });

  it('regenerate to deep-equal items, in and out of JSON', () => {
    for (const request of REQUESTS) {
      const item = generate(request);
      expect(regenerate(item.ref)).toEqual(item);
      expect(regenerate(JSON.parse(JSON.stringify(item.ref)))).toEqual(item);
      expect(JSON.stringify(regenerate(item.ref))).toBe(JSON.stringify(item));
    }
  });
});
