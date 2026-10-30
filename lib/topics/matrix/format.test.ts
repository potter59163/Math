import { describe, expect, it } from 'vitest';
import { givenMatrices } from './format';
import { generate } from './generators';
import { SKILLS, levelsOf } from './skills';

describe('givenMatrices', () => {
  it('shows every matrix an item holds, so a new form cannot silently hide one', () => {
    for (const { id } of SKILLS) {
      for (const difficulty of levelsOf(id)) {
        for (let seed = 0; seed < 50; seed += 1) {
          const { data } = generate({ skill: id, difficulty, seed });
          const held = Object.keys(data).filter((key) => /^(A|B|AB)$/.test(key));
          expect(givenMatrices(data).map(({ label }) => label)).toEqual(held);
        }
      }
    }
  });
});
