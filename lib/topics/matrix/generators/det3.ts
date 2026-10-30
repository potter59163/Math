import type { Rng } from '@/lib/core/prng';
import type { Level } from '@/lib/core/types';
import { det3 as detOf } from '../ops';
import type { SkillGenerator } from '../types';
import { fromFlat, range, wrongForm } from './sample';

const CELL_NAMES = 'abcdefghi';
const B_CELL = CELL_NAMES.indexOf('b');
const NOT_B = range(0, 8).filter((cell) => cell !== B_CELL);

// Where L1 may put its zeros. Elsewhere two M13 variants coincide for all values (a = g = 0 makes
// ALL_PLUS equal NO_ALT_SIGN) or one equals det, so this list came from measuring every placement.
const L1_ZERO_SETS = [
  ...['ac', 'ad', 'ae', 'af', 'ah', 'ai', 'cd', 'ce', 'cg', 'ch', 'ci'],
  ...['de', 'dh', 'di', 'eg', 'eh', 'ei', 'fh', 'hi'],
  ...['ace', 'ach', 'adh', 'adi', 'aeh', 'afh', 'ahi'],
  ...['cde', 'cdi', 'ceg', 'ceh', 'cei', 'dei', 'dhi'],
].map((names) => [...names].map((name) => CELL_NAMES.indexOf(name)));

// Small values are more common, so few draws break the limit on Sarrus products.
const L1_POOL = [1, 1, 2, 2, 3, 3, 4, 5];
const L2_POOL = [-3, -2, -1, 1, 2, 3, 4, 5];
const L3_POOL = range(-4, 6);

// M13's NO_ALT_SIGN differs from det by 2·b·M₁₂, so b must never be zero (§2 rule 1).
function sampleCells(rng: Rng, level: Level): number[] {
  if (level === 3) {
    const nonZeroPool = L3_POOL.filter((value) => value !== 0);
    return range(0, 8).map((cell) => rng.pick(cell === B_CELL ? nonZeroPool : L3_POOL));
  }
  const zeros = level === 1 ? rng.pick(L1_ZERO_SETS) : [rng.pick(NOT_B)];
  const pool = level === 1 ? L1_POOL : L2_POOL;
  return range(0, 8).map((cell) => (zeros.includes(cell) ? 0 : rng.pick(pool)));
}

export const det3: SkillGenerator = {
  sample(rng, level) {
    return { form: 'det3', A: fromFlat(sampleCells(rng, level), { rows: 3, cols: 3 }) };
  },

  body(data) {
    if (data.form !== 'det3') throw wrongForm('det3', data.form);
    return {
      kind: 'scalar',
      prompt: { key: 'det_find' },
      data,
      correct: { kind: 'scalar', value: detOf(data.A) },
    };
  },
};
