import type { Rng } from '@/lib/core/prng';
import { figureKey } from '../format';
import { QUANTITY_KIND, quantityKey, solve } from '../solve';
import type { ItemBody, Quantity, SkillGenerator, Term, VectorData } from '../types';
import {
  figureOptions,
  figureTerms,
  HALF,
  ONE,
  parallelogram,
  reversed,
  term,
  TWO,
  triangleWithMidpoints,
  vertex,
  whole,
  wrongForm,
} from './sample';

/** Vector quantities and the scalar each is mixed up with (V01). */
const PAIRS: [Quantity, Quantity][] = [
  ['velocity', 'speed'],
  ['displacement', 'distance'],
  ['weight', 'mass'],
];

const ALL = Object.keys(QUANTITY_KIND) as Quantity[];

function quantityKind(rng: Rng): VectorData {
  const ask = rng.pick(['vector', 'scalar'] as const);
  const [vectorOne, scalarOne] = rng.pick(PAIRS);
  const [answer, partner] = ask === 'vector' ? [vectorOne, scalarOne] : [scalarOne, vectorOne];
  // Every other option is of the other kind, so exactly one is right.
  const others = ALL.filter((q) => QUANTITY_KIND[q] !== ask && q !== partner);
  return {
    form: 'quantity_kind',
    ask,
    options: rng.shuffle([answer, partner, ...rng.sample(others, 2)]),
  };
}

/** L2: "which vector equals AB?" in parallelogram ABCD. The answer is the opposite side. */
function parallelogramEqual(rng: Rng): VectorData {
  const figure = parallelogram(rng);
  const start = rng.int(0, 3);
  const step = rng.pick([1, -1]);
  const of = whole(vertex(start), vertex(start, step));
  // The opposite side, walked the same way: AB = DC.
  const same = whole(vertex(start, -step), vertex(start, 2 * step));
  const negative = rng.chance(1, 3);
  const answer = negative ? reversed(same) : same;
  return {
    form: 'figure_equal',
    figure,
    of,
    negative,
    options: figureOptions(rng, figure, answer, reversed(answer), figureTerms(figure)),
  };
}

/** L3: triangle with the midpoints M, N of PQ and PR, so QR = 2MN and PM = MQ. */
function triangleEqual(rng: Rng): VectorData {
  const { figure, apex: p, left: q, right: r } = triangleWithMidpoints(rng);
  const asks: [Term, Term][] = [
    [whole(q, r), term(TWO, 'M', 'N')],
    [whole('M', 'N'), term(HALF, q, r)],
    [whole(p, 'M'), whole('M', q)],
    [whole('M', q), whole(p, 'M')],
    [whole(p, 'N'), whole('N', r)],
    [whole('N', r), whole(p, 'N')],
  ];
  const [base, sameDirection] = rng.pick(asks);
  const flip = rng.chance(1, 2);
  const of = flip ? reversed(base) : base;
  const same = flip ? reversed(sameDirection) : sameDirection;
  const negative = rng.chance(1, 3);
  const answer = negative ? reversed(same) : same;
  // A decoy with the right direction and the wrong length: 2MN shown beside MN.
  const wrongLength = term(answer.k.equals(ONE) ? TWO : ONE, answer.from, answer.to);
  return {
    form: 'figure_equal',
    figure,
    of,
    negative,
    options: figureOptions(
      rng,
      figure,
      answer,
      reversed(answer),
      figureTerms(figure, [ONE, TWO, HALF]),
      [wrongLength],
    ),
  };
}

export const quantity: SkillGenerator = {
  sample(rng, level) {
    if (level === 1) return quantityKind(rng);
    return level === 2 ? parallelogramEqual(rng) : triangleEqual(rng);
  },

  body(data): ItemBody {
    switch (data.form) {
      case 'quantity_kind':
        return {
          kind: 'choice',
          prompt: { key: data.ask === 'vector' ? 'quantity_vector' : 'quantity_scalar' },
          data,
          options: data.options.map((q) => ({ id: quantityKey(q), labelKey: quantityKey(q) })),
          correct: solve(data),
        };
      case 'figure_equal': {
        const name = `${data.of.from}${data.of.to}`;
        return {
          kind: 'choice',
          prompt: { key: data.negative ? 'figure_negative' : 'figure_equal', params: { v: name } },
          data,
          options: data.options.map((t) => ({ id: figureKey(t), labelKey: figureKey(t) })),
          correct: solve(data),
        };
      }
      default:
        throw wrongForm('v_quantity', data.form);
    }
  },
};
