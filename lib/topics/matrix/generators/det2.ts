import { det2 as detOf, matrix } from '../ops';
import type { SkillGenerator } from '../types';
import { range, wrongForm } from './sample';

const MAGNITUDES = range(1, 9);

export const det2: SkillGenerator = {
  // Four different magnitudes rule out every M12 collision except two rare ones, so nearly every
  // draw is usable. Drawing cells independently passes validateItem only about 19% of the time.
  sample(rng, level) {
    const [w, x, y, z] = rng.sample(MAGNITUDES, 4);
    if (level === 1) {
      // The larger product goes on the main diagonal, since this level needs det > 0.
      const [a, d, b, c] = w * z > x * y ? [w, z, x, y] : [x, y, w, z];
      return {
        form: 'det2',
        A: matrix([
          [a, b],
          [c, d],
        ]),
      };
    }
    const cells = [w, x, y, z];
    const signs = cells.map(() => (rng.chance(1, 2) ? -1 : 1));
    signs[rng.int(0, 3)] = -1;
    const [a, b, c, d] = cells.map((cell, i) => cell * signs[i]);
    return {
      form: 'det2',
      A: matrix([
        [a, b],
        [c, d],
      ]),
    };
  },

  body(data) {
    if (data.form !== 'det2') throw wrongForm('det2', data.form);
    return {
      kind: 'scalar',
      prompt: { key: 'det_find' },
      data,
      correct: { kind: 'scalar', value: detOf(data.A) },
    };
  },
};
