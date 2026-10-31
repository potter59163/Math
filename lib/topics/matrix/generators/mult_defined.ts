import type { Rng } from '@/lib/core/prng';
import type { Dims } from '@/lib/core/types';
import { dimsLabel } from '../format';
import type { ItemBody, MatrixData, Probe, SkillGenerator } from '../types';
import { wrongForm } from './sample';

type Pair = { first: Dims; second: Dims };

/** Distinct m, n, p keep every wrong result rule apart from the correct m×p and from each other. */
function definedDistinct(rng: Rng, sizes: number[]): Pair {
  const [m, n, p] = rng.sample(sizes, 3);
  return { first: { rows: m, cols: n }, second: { rows: n, cols: p } };
}

function definedAny(rng: Rng, sizes: number[]): Pair {
  const m = rng.pick(sizes);
  const n = rng.pick(sizes);
  // m = n = p would leave no wrong rule to catch.
  const p = rng.pick(m === n ? sizes.filter((size) => size !== m) : sizes);
  return { first: { rows: m, cols: n }, second: { rows: n, cols: p } };
}

function sameDims(rng: Rng, sizes: number[]): Pair {
  const [m, n] = rng.sample(sizes, 2);
  return { first: { rows: m, cols: n }, second: { rows: m, cols: n } };
}

function otherUndefined(rng: Rng, sizes: number[]): Pair {
  const n = rng.pick(sizes);
  return {
    first: { rows: rng.pick(sizes), cols: n },
    second: { rows: rng.pick(sizes.filter((size) => size !== n)), cols: rng.pick(sizes) },
  };
}

/** Undefined with different dims, and m ≠ n keeps every wrong result rule apart from the others. */
function undefinedDistinct(rng: Rng, sizes: number[]): Pair {
  const [m, n] = rng.sample(sizes, 2);
  const notN = sizes.filter((size) => size !== n);
  const r = rng.pick(notN);
  // r = m with p = n would be the same dims.
  const p = rng.pick(r === m ? notN : sizes);
  return { first: { rows: m, cols: n }, second: { rows: r, cols: p } };
}

function samplePair(rng: Rng, sizes: number[], { target, targetVariant }: Probe): Pair {
  if (targetVariant === 'SAME_DIMS') {
    return rng.chance(1, 2) ? sameDims(rng, sizes) : definedDistinct(rng, sizes);
  }
  if (targetVariant === 'RESULT_OUTER') return undefinedDistinct(rng, sizes);
  if (targetVariant !== undefined) return definedDistinct(rng, sizes);
  if (target !== undefined) {
    return rng.chance(1, 4) ? sameDims(rng, sizes) : definedDistinct(rng, sizes);
  }
  const scenario = rng.int(1, 4);
  if (scenario <= 2) return definedAny(rng, sizes);
  return scenario === 3 ? sameDims(rng, sizes) : otherUndefined(rng, sizes);
}

function sampleChain(rng: Rng, sizes: number[]): MatrixData {
  const [a, b, c, d] = [rng.pick(sizes), rng.pick(sizes), rng.pick(sizes), rng.pick(sizes)];
  const dimsA = { rows: a, cols: b };
  const dimsC = { rows: c, cols: d };
  if (rng.chance(1, 2))
    return { form: 'mult_defined_abc', dimsA, dimsB: { rows: b, cols: c }, dimsC };
  // Break one of the two links.
  const wrong = (size: number) => rng.pick(sizes.filter((other) => other !== size));
  const dimsB = rng.chance(1, 2) ? { rows: wrong(b), cols: c } : { rows: b, cols: wrong(c) };
  return { form: 'mult_defined_abc', dimsA, dimsB, dimsC };
}

export const multDefined: SkillGenerator = {
  sample(rng, level, probe) {
    if (level === 3) return sampleChain(rng, [1, 2, 3, 4]);
    const sizes = level === 1 ? [2, 3, 4] : [1, 2, 3, 4];
    const { first, second } = samplePair(rng, sizes, probe);
    const order = level === 1 ? 'AB' : rng.pick(['AB', 'BA'] as const);
    return order === 'AB'
      ? { form: 'mult_defined', order, dimsA: first, dimsB: second }
      : { form: 'mult_defined', order, dimsA: second, dimsB: first };
  },

  body(data): ItemBody {
    if (data.form === 'mult_defined') {
      const { order, dimsA, dimsB } = data;
      const [first, second] = order === 'AB' ? [dimsA, dimsB] : [dimsB, dimsA];
      return {
        kind: 'dims_or_undefined',
        prompt: {
          key: order === 'AB' ? 'mult_defined_ab' : 'mult_defined_ba',
          params: { dimsA: dimsLabel(dimsA), dimsB: dimsLabel(dimsB) },
        },
        data,
        correct:
          first.cols === second.rows
            ? { kind: 'dims', rows: first.rows, cols: second.cols }
            : { kind: 'undefined' },
      };
    }
    if (data.form === 'mult_defined_abc') {
      const { dimsA, dimsB, dimsC } = data;
      return {
        kind: 'dims_or_undefined',
        prompt: {
          key: 'mult_defined_abc',
          params: {
            dimsA: dimsLabel(dimsA),
            dimsB: dimsLabel(dimsB),
            dimsC: dimsLabel(dimsC),
          },
        },
        data,
        correct:
          dimsA.cols === dimsB.rows && dimsB.cols === dimsC.rows
            ? { kind: 'dims', rows: dimsA.rows, cols: dimsC.cols }
            : { kind: 'undefined' },
      };
    }
    throw wrongForm('mult_defined', data.form);
  },
};
