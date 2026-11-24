import { Surd } from '@/lib/core/surd';
import { surdText } from '../format';
import { isZeroVec } from '../ops';
import { solve } from '../solve';
import { STANDARD_ANGLES, type Angle, type ItemBody, type SkillGenerator } from '../types';
import { drawUntil, drawVec, negative, range, wrongForm } from './sample';

/** Lengths given at L3: whole numbers and the simple roots of the chapter. */
const LENGTHS: Surd[] = [
  ...[2, 3, 4, 5, 6].map((n) => Surd.rational(n)),
  Surd.of(1, 2),
  Surd.of(1, 3),
  Surd.of(2, 2),
  Surd.of(2, 3),
  Surd.of(3, 2),
];

/** At 90° forgetting cos θ and using sin θ give the same |u||v| (V15 = V16); at 45° sin θ = cos θ. */
const ANGLES_FOR: Record<string, readonly Angle[]> = {
  V15_DOT_NO_COS: STANDARD_ANGLES.filter((theta) => theta !== 0 && theta !== 90),
  V16_DOT_SIN: STANDARD_ANGLES.filter((theta) => theta !== 45 && theta !== 90),
};

export const dot: SkillGenerator = {
  sample(rng, level, { target }) {
    if (level === 1) {
      return drawUntil(
        () =>
          ({
            form: 'dot',
            u: drawVec(rng, 2, range(-5, 7)),
            v: drawVec(rng, 2, range(-5, 7)),
          }) as const,
        ({ u, v }) => !isZeroVec(u) && !isZeroVec(v),
      );
    }
    if (level === 2) {
      return drawUntil(
        () =>
          ({
            form: 'dot',
            u: drawVec(rng, 3, range(-7, 7)),
            v: drawVec(rng, 3, range(-7, 7)),
          }) as const,
        ({ u, v }) => !isZeroVec(u) && !isZeroVec(v) && negative([...u, ...v]),
      );
    }
    return {
      form: 'dot_polar',
      normU: rng.pick(LENGTHS),
      normV: rng.pick(LENGTHS),
      theta: rng.pick((target && ANGLES_FOR[target]) || STANDARD_ANGLES),
    };
  },

  body(data): ItemBody {
    switch (data.form) {
      case 'dot':
        return { kind: 'surd', prompt: { key: 'dot_find' }, data, correct: solve(data) };
      case 'dot_polar':
        return {
          kind: 'surd',
          prompt: {
            key: 'dot_polar',
            params: {
              u: surdText(data.normU),
              v: surdText(data.normV),
              theta: String(data.theta),
            },
          },
          data,
          correct: solve(data),
        };
      default:
        throw wrongForm('v_dot', data.form);
    }
  },
};
