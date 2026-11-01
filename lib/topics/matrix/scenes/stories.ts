import { createRng, type Rng } from '@/lib/core/prng';
import type { Matrix } from '@/lib/core/types';
import { det, matrix } from '../ops';

// The numbers of a unit's intro clip, drawn for one student. Each is small enough to follow by eye, and
// its shape is what the clip needs: the stories themselves are in th.scenes.intro.stories.

function ints(rng: Rng, rows: number, cols: number, low: number, high: number): number[][] {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => rng.int(low, high)));
}

export interface IntroNumbers {
  sales: Matrix;
  branchA: Matrix;
  branchB: Matrix;
  reorder: number;
  quantities: Matrix;
  prices: Matrix;
  stretch: Matrix;
  undoable: Matrix;
}

// Each keeps det > 0, so its grid never flattens on the way (SCENES §3.3).
const STRETCHES = [
  [
    [2, 1],
    [0, 1],
  ],
  [
    [1, 1],
    [0, 2],
  ],
  [
    [2, 0],
    [1, 1],
  ],
  [
    [3, 1],
    [0, 1],
  ],
  [
    [1, 0],
    [1, 3],
  ],
];

// Each holds a zero, which `invertible` L1 never does, so an intro can never be the item after it.
const UNDOABLE = [
  [
    [1, 2],
    [0, 1],
  ],
  [
    [1, 0],
    [2, 1],
  ],
  [
    [2, 1],
    [0, 1],
  ],
  [
    [1, 1],
    [0, 2],
  ],
];

const PRICES = [5, 10, 15, 20, 25, 30];

const SALES_LOW = 3;
const SALES_HIGH = 15;
const BRANCH_LOW = 2;
const BRANCH_HIGH = 12;
const QUANTITY_LOW = 1;
const QUANTITY_HIGH = 6;

/** The fixed numbers of docs/SCENES.md §5, which a test can check against the doc. */
export const DOCUMENTED_NUMBERS: IntroNumbers = {
  sales: matrix([
    [12, 5, 8],
    [7, 9, 4],
  ]),
  branchA: matrix([
    [12, 5],
    [7, 9],
  ]),
  branchB: matrix([
    [3, 8],
    [5, 2],
  ]),
  reorder: 2,
  quantities: matrix([
    [3, 2],
    [1, 4],
  ]),
  prices: matrix([[20], [15]]),
  stretch: matrix(STRETCHES[0]),
  undoable: matrix(UNDOABLE[0]),
};

export function introNumbers(seed: number): IntroNumbers {
  const rng = createRng(seed);
  const first = rng.pick(PRICES);
  const second = rng.pick(PRICES.filter((price) => price !== first));
  const numbers: IntroNumbers = {
    sales: matrix(ints(rng, 2, 3, SALES_LOW, SALES_HIGH)),
    branchA: matrix(ints(rng, 2, 2, BRANCH_LOW, BRANCH_HIGH)),
    branchB: matrix(ints(rng, 2, 2, BRANCH_LOW, BRANCH_HIGH)),
    reorder: rng.pick([2, 3]),
    quantities: matrix(ints(rng, 2, 2, QUANTITY_LOW, QUANTITY_HIGH)),
    prices: matrix([[first], [second]]),
    stretch: matrix(rng.pick(STRETCHES)),
    undoable: matrix(rng.pick(UNDOABLE)),
  };
  if (det(numbers.stretch).sign() <= 0)
    throw new Error('introNumbers: a stretch must keep its side');
  return numbers;
}
