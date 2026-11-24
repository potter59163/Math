import { createRng, type Rng } from '@/lib/core/prng';
import { Rational } from '@/lib/core/rational';
import { Surd } from '@/lib/core/surd';
import type { Answer, Item } from '@/lib/core/types';
import type { MisconceptionId } from '@/lib/topics/types';

// Answers a simulated student can give. For tests, `npm run sim` and /dev/director, not for students.
// The √ kinds only get answers that are plainly wrong, until a topic that uses them refines these.

const FAR_OFF = 77;

/** Exactly one wrong cell on a matrix item, which classify calls a slip. Near misses elsewhere. */
export function slipAnswer(item: Item): Answer {
  const { correct } = item;
  switch (correct.kind) {
    case 'matrix':
      return {
        kind: 'matrix',
        value: correct.value.map((row, i) =>
          row.map((cell, j) => (i === 0 && j === 0 ? cell.add(Rational.ONE) : cell)),
        ),
      };
    case 'scalar':
      return { kind: 'scalar', value: correct.value.add(Rational.ONE) };
    case 'dims':
      return { kind: 'dims', rows: correct.rows + 1, cols: correct.cols };
    case 'choice':
      return { kind: 'choice', id: otherChoice(item) };
    case 'surd':
    case 'vector':
    case 'undefined':
      return unknownAnswer(item);
  }
}

const partsOf = ({ correct }: Item): number =>
  correct.kind === 'vector' ? correct.value.length : 3;

function otherChoice(item: Item): string {
  const { correct, options = [] } = item;
  const other = options.find(({ id }) => correct.kind !== 'choice' || id !== correct.id);
  return other?.id ?? 'none';
}

/** Wrong in a way the catalog does not know, so it comes back as unknown or shape_error. */
export function unknownAnswer(item: Item): Answer {
  const { correct, grid } = item;
  switch (item.kind) {
    case 'matrix':
    case 'matrix_or_undefined': {
      const rows = grid?.rows ?? 1;
      const cols = grid?.cols ?? 1;
      if (correct.kind === 'undefined') return { kind: 'dims', rows, cols };
      return {
        kind: 'matrix',
        value: Array.from({ length: rows }, () =>
          Array.from({ length: cols }, () => Rational.of(FAR_OFF)),
        ),
      };
    }
    case 'scalar':
    case 'cell':
      return {
        kind: 'scalar',
        value: correct.kind === 'scalar' ? correct.value.add(Rational.of(FAR_OFF)) : Rational.ZERO,
      };
    case 'dims':
    case 'dims_or_undefined':
      return { kind: 'dims', rows: 97, cols: 98 };
    case 'choice':
      return { kind: 'choice', id: 'none' };
    case 'surd':
      return { kind: 'surd', value: Surd.of(FAR_OFF) };
    case 'vector':
      return {
        kind: 'vector',
        value: Array.from({ length: partsOf(item) }, () => Surd.of(FAR_OFF)),
      };
  }
}

function randomMatrix(item: Item, rng: Rng): Answer {
  const value = Array.from({ length: item.grid?.rows ?? 1 }, () =>
    Array.from({ length: item.grid?.cols ?? 1 }, () => Rational.of(rng.int(-9, 9))),
  );
  return { kind: 'matrix', value };
}

/** What this misconception would answer here, or null if the item cannot show it. */
export function misconceptionAnswer(
  item: Item,
  id: MisconceptionId,
  variant?: string,
  rng: Rng = createRng(item.ref.seed),
): Answer | null {
  const found = item.diagnostics.find(
    (diagnostic) =>
      diagnostic.id === id && (variant === undefined || diagnostic.variant === variant),
  );
  if (!found) return null;
  return found.answer.kind === 'any_matrix' ? randomMatrix(item, rng) : found.answer;
}

/** Somebody tapping at random. It can be right by luck, as on a two-way choice. */
export function randomAnswer(item: Item, rng: Rng): Answer {
  switch (item.kind) {
    case 'matrix':
    case 'matrix_or_undefined':
      if (item.kind === 'matrix_or_undefined' && rng.chance(1, 4)) return { kind: 'undefined' };
      return randomMatrix(item, rng);
    case 'scalar':
    case 'cell':
      return { kind: 'scalar', value: Rational.of(rng.int(-20, 20)) };
    case 'dims':
    case 'dims_or_undefined':
      if (item.kind === 'dims_or_undefined' && rng.chance(1, 4)) return { kind: 'undefined' };
      return { kind: 'dims', rows: rng.int(1, 4), cols: rng.int(1, 4) };
    case 'choice':
      return { kind: 'choice', id: rng.pick(item.options ?? []).id };
    case 'surd':
      return { kind: 'surd', value: Surd.of(rng.int(-20, 20)) };
    case 'vector':
      return {
        kind: 'vector',
        value: Array.from({ length: partsOf(item) }, () => Surd.of(rng.int(-9, 9))),
      };
  }
}
