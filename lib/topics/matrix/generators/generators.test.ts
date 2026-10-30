import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { classify } from '@/lib/core/classify';
import { deriveSeed, createRng } from '@/lib/core/prng';
import { Rational } from '@/lib/core/rational';
import type { Answer, Level, Matrix } from '@/lib/core/types';
import { CATALOG, probeLevels, variantsOf } from '../misconceptions';
import { equals, identity, mul } from '../ops';
import { validateMatrixItem } from '../rules';
import { SKILLS, levelsOf, type SkillId } from '../skills';
import type { GenerateRequest, MatrixItem } from '../types';
import { generate, generateDetailed, MAX_TRIES, regenerate } from '.';

const seedArb = fc.integer({ min: 0, max: 0xffffffff });

const SKILL_LEVELS: [SkillId, Level][] = SKILLS.flatMap(({ id }) =>
  levelsOf(id).map((level): [SkillId, Level] => [id, level]),
);

function randomMatrix(seed: number, rows: number, cols: number): Matrix {
  const rng = createRng(seed);
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => Rational.of(rng.int(-9, 9))),
  );
}

/** Every generated item must satisfy the four properties PLAN.md lists. */
function expectSound(item: MatrixItem, seed: number) {
  expect(validateMatrixItem(item)).toEqual({ ok: true });
  expect(classify(item, item.correct)).toEqual({ type: 'correct' });

  for (const diagnostic of item.diagnostics) {
    const answer: Answer =
      diagnostic.answer.kind === 'any_matrix'
        ? { kind: 'matrix', value: randomMatrix(seed, item.grid!.rows, item.grid!.cols) }
        : diagnostic.answer;
    const expected =
      diagnostic.variant === undefined
        ? { type: 'misconception', id: diagnostic.id }
        : { type: 'misconception', id: diagnostic.id, variant: diagnostic.variant };
    expect(classify(item, answer)).toEqual(expected);
  }

  if (item.data.form === 'inv2' && item.correct.kind === 'matrix') {
    expect(equals(mul(item.data.A, item.correct.value), identity(2))).toBe(true);
    expect(equals(mul(item.correct.value, item.data.A), identity(2))).toBe(true);
  }
}

describe('every skill × level', () => {
  it.each(SKILL_LEVELS)('%s L%i is valid, correct and self-classifying', (skill, difficulty) => {
    fc.assert(
      fc.property(seedArb, (seed) => {
        expectSound(generate({ skill, difficulty, seed }), seed);
      }),
    );
  });

  it.each(SKILL_LEVELS)('%s L%i regenerates identically from its ref', (skill, difficulty) => {
    fc.assert(
      fc.property(seedArb, (seed) => {
        const item = generate({ skill, difficulty, seed });
        expect(regenerate(item.ref)).toEqual(item);
      }),
    );
  });

  it.each(SKILL_LEVELS)('%s L%i keeps the requested seed in its ref', (skill, difficulty) => {
    const item = generate({ skill, difficulty, seed: 123 });
    expect(item.ref).toEqual({ topic: 'matrix', skill, difficulty, seed: 123, gv: 1 });
  });

  it.each(SKILL_LEVELS)('%s L%i works for seeds from deriveSeed', (skill, difficulty) => {
    for (let counter = 0; counter < 200; counter += 1) {
      const seed = deriveSeed('00000000-0000-4000-8000-000000000000', counter);
      expectSound(generate({ skill, difficulty, seed }), seed);
    }
  });
});

describe('slip and shape_error on matrix items', () => {
  const MATRIX_SKILL_LEVELS = SKILL_LEVELS.filter(([skill, difficulty]) => {
    const { kind } = generate({ skill, difficulty, seed: 1 });
    return kind === 'matrix' || kind === 'matrix_or_undefined';
  });

  it.each(MATRIX_SKILL_LEVELS)(
    '%s L%i: one wrong cell is a slip at that cell',
    (skill, difficulty) => {
      fc.assert(
        fc.property(seedArb, fc.nat(), fc.nat(), (seed, rowPick, colPick) => {
          const item = generate({ skill, difficulty, seed });
          if (item.correct.kind !== 'matrix') return;
          const value = item.correct.value.map((row) => [...row]);
          const i = rowPick % value.length;
          const j = colPick % value[0].length;
          value[i][j] = value[i][j].add(Rational.ONE);
          expect(classify(item, { kind: 'matrix', value })).toEqual({
            type: 'slip',
            cell: [i + 1, j + 1],
          });
        }),
      );
    },
  );

  it.each(MATRIX_SKILL_LEVELS)('%s L%i: a wrong shape is a shape_error', (skill, difficulty) => {
    fc.assert(
      fc.property(seedArb, (seed) => {
        const item = generate({ skill, difficulty, seed });
        if (item.correct.kind !== 'matrix') return;
        const { rows } = item.grid!;
        const wrong = randomMatrix(seed, rows + 1, 1);
        expect(classify(item, { kind: 'matrix', value: wrong })).toEqual({ type: 'shape_error' });
      }),
    );
  });

  it('answering "undefined" on a computable matrix_or_undefined item is a shape_error', () => {
    fc.assert(
      fc.property(seedArb, (seed) => {
        const item = generate({ skill: 'addsub', difficulty: 2, seed, target: 'M05_SUB_REVERSED' });
        expect(classify(item, { kind: 'undefined' })).toEqual({ type: 'shape_error' });
      }),
    );
  });

  it('the answer grid matches the correct answer whenever one exists', () => {
    for (const [skill, difficulty] of MATRIX_SKILL_LEVELS) {
      for (let seed = 0; seed < 200; seed += 1) {
        const item = generate({ skill, difficulty, seed });
        if (item.correct.kind !== 'matrix') continue;
        expect(item.correct.value.length).toBe(item.grid!.rows);
        expect(item.correct.value[0].length).toBe(item.grid!.cols);
      }
    }
  });
});

describe('sampling does not lean on rejection', () => {
  const REQUESTS: GenerateRequest[] = [
    ...SKILL_LEVELS.map(([skill, difficulty]) => ({ skill, difficulty, seed: 0 })),
    ...CATALOG.flatMap((entry) =>
      entry.skills.flatMap((skill) =>
        probeLevels(skill, entry.id).flatMap((difficulty) => [
          { skill, difficulty, seed: 0, target: entry.id },
          ...variantsOf(entry.id)
            .filter((variant): variant is string => variant !== undefined)
            .filter((variant) => probeLevels(skill, entry.id, variant).includes(difficulty))
            .map((targetVariant) => ({
              skill,
              difficulty,
              seed: 0,
              target: entry.id,
              targetVariant,
            })),
        ]),
      ),
    ),
  ];

  const name = ({ skill, difficulty, target, targetVariant }: GenerateRequest) =>
    [skill, `L${difficulty}`, target, targetVariant].filter(Boolean).join(' ');

  // At 70% per draw, 50 draws all fail with probability 0.3^50 ≈ 7e-27.
  const MIN_FIRST_TRY_RATE = 0.7;
  const SAMPLE = 2000;

  it.each(REQUESTS.map((request) => [name(request), request] as const))(
    '%s passes on the first draw at least 70% of the time',
    (_, request) => {
      let firstTry = 0;
      let worst = 0;
      for (let seed = 0; seed < SAMPLE; seed += 1) {
        const { tries } = generateDetailed({ ...request, seed: seed * 7919 });
        if (tries === 1) firstTry += 1;
        worst = Math.max(worst, tries);
      }
      expect(firstTry / SAMPLE).toBeGreaterThanOrEqual(MIN_FIRST_TRY_RATE);
      expect(worst).toBeLessThan(MAX_TRIES);
    },
  );
});

describe('numbers vary, so neighbours cannot copy', () => {
  it.each(SKILL_LEVELS)('%s L%i gives different items across seeds', (skill, difficulty) => {
    const seen = new Set<string>();
    for (let seed = 0; seed < 100; seed += 1) {
      seen.add(JSON.stringify(generate({ skill, difficulty, seed: seed * 7919 }).data));
    }
    // mult_noncomm L1 is a true/false statement, not numbers.
    const atLeast = skill === 'mult_noncomm' && difficulty === 1 ? 3 : 20;
    expect(seen.size).toBeGreaterThanOrEqual(atLeast);
  });

  it('two students get different items from the same step', () => {
    const items = Array.from({ length: 40 }, (_, seat) =>
      JSON.stringify(
        generate({ skill: 'mult', difficulty: 1, seed: deriveSeed(`student-${seat}`, 5) }).data,
      ),
    );
    expect(new Set(items).size).toBe(40);
  });
});

describe('levels mix what SPEC §3 says they mix', () => {
  function tally(request: Omit<GenerateRequest, 'seed'>, key: (item: MatrixItem) => string) {
    const counts = new Map<string, number>();
    for (let seed = 0; seed < 400; seed += 1) {
      const label = key(generate({ ...request, seed: seed * 7919 }));
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
    return counts;
  }

  const correctId = (item: MatrixItem) =>
    item.correct.kind === 'choice' ? item.correct.id : item.correct.kind;

  it.each<Level>([1, 2, 3])('invertible L%i mixes both answers', (difficulty) => {
    const counts = tally({ skill: 'invertible', difficulty }, correctId);
    expect(counts.get('has_inverse')).toBeGreaterThan(100);
    expect(counts.get('no_inverse')).toBeGreaterThan(100);
  });

  it('invertible L2 always shows a zero and L1 never does', () => {
    for (let seed = 0; seed < 400; seed += 1) {
      const one = generate({ skill: 'invertible', difficulty: 1, seed });
      const two = generate({ skill: 'invertible', difficulty: 2, seed });
      if (one.data.form !== 'invertible' || two.data.form !== 'invertible') throw new Error('form');
      expect(one.data.A.flat().some((cell) => cell.isZero())).toBe(false);
      expect(two.data.A.flat().some((cell) => cell.isZero())).toBe(true);
    }
  });

  it('mult_noncomm L3 mixes pairs that commute and pairs that do not', () => {
    const counts = tally({ skill: 'mult_noncomm', difficulty: 3 }, correctId);
    expect(counts.get('swap_yes')).toBeGreaterThan(50);
    expect(counts.get('swap_no')).toBeGreaterThan(50);
  });

  it.each<Level>([2, 3])(
    'addsub L%i has computable and undefined items under one kind',
    (difficulty) => {
      const counts = tally({ skill: 'addsub', difficulty }, correctId);
      expect(counts.get('matrix')).toBeGreaterThan(100);
      expect(counts.get('undefined')).toBeGreaterThan(50);
      expect(generate({ skill: 'addsub', difficulty, seed: 1 }).kind).toBe('matrix_or_undefined');
    },
  );

  it('addsub L1 only adds, under the plain matrix kind', () => {
    const counts = tally(
      { skill: 'addsub', difficulty: 1 },
      (item) => `${item.kind}/${item.prompt.key}`,
    );
    expect([...counts.keys()]).toEqual(['matrix/addsub_add']);
  });

  it.each<Level>([1, 2, 3])('mult_defined L%i mixes defined and undefined', (difficulty) => {
    const counts = tally({ skill: 'mult_defined', difficulty }, correctId);
    expect(counts.get('dims')).toBeGreaterThan(100);
    expect(counts.get('undefined')).toBeGreaterThan(100);
  });

  it('mult_defined L2 asks both AB and BA', () => {
    const counts = tally({ skill: 'mult_defined', difficulty: 2 }, (item) => item.prompt.key);
    expect(counts.get('mult_defined_ab')).toBeGreaterThan(100);
    expect(counts.get('mult_defined_ba')).toBeGreaterThan(100);
  });

  it('det_props L2 mixes det(kA), det(AB) and det(A+B)', () => {
    const counts = tally({ skill: 'det_props', difficulty: 2 }, (item) => item.data.form);
    for (const form of ['det_scaled', 'det_product', 'det_sum']) {
      expect(counts.get(form)).toBeGreaterThan(80);
    }
  });

  it('det_props L3 mixes det(Aᵀ) and det(A⁻¹)', () => {
    const counts = tally({ skill: 'det_props', difficulty: 3 }, (item) => item.data.form);
    expect(counts.get('det_transpose')).toBeGreaterThan(100);
    expect(counts.get('det_inverse')).toBeGreaterThan(100);
  });

  it('M07 and M08 have no diagnostic at L3', () => {
    for (let seed = 0; seed < 200; seed += 1) {
      expect(generate({ skill: 'scalar', difficulty: 3, seed }).diagnostics).toEqual([]);
      expect(generate({ skill: 'mult_defined', difficulty: 3, seed }).diagnostics).toEqual([]);
    }
  });

  it('M14 and M15 have no diagnostic at det_props L3', () => {
    for (let seed = 0; seed < 200; seed += 1) {
      expect(generate({ skill: 'det_props', difficulty: 3, seed }).diagnostics).toEqual([]);
    }
  });

  it('M12 applies to every det2 item, so a wrong formula is always caught', () => {
    for (const difficulty of [1, 2] as const) {
      for (let seed = 0; seed < 400; seed += 1) {
        const item = generate({ skill: 'det2', difficulty, seed: seed * 7919 });
        expect(item.diagnostics.length).toBeGreaterThanOrEqual(3);
        expect(new Set(item.diagnostics.map((d) => d.id))).toEqual(new Set(['M12_DET2_FORMULA']));
      }
    }
  });
});

describe('generate guards', () => {
  it('has no L3 for det2 (☆)', () => {
    expect(() => generate({ skill: 'det2', difficulty: 3, seed: 1 })).toThrow(/det2/);
  });

  it('rejects a non-integer seed', () => {
    expect(() => generate({ skill: 'dim', difficulty: 1, seed: 1.5 })).toThrow(/seed/);
  });

  it('rejects a variant with no target', () => {
    expect(() =>
      generate({ skill: 'inv2', difficulty: 2, seed: 1, targetVariant: 'NO_SWAP' }),
    ).toThrow(/target/);
  });

  it('survives seeds at the top of the range, where seed + tries wraps', () => {
    const item = generate({ skill: 'det2', difficulty: 1, seed: 0xffffffff });
    expect(validateMatrixItem(item)).toEqual({ ok: true });
  });
});

describe('regenerate', () => {
  it('throws for a ref from another generator version, rather than returning a different item', () => {
    const { ref } = generate({ skill: 'mult', difficulty: 1, seed: 1 });
    expect(() => regenerate({ ...ref, gv: ref.gv + 1 })).toThrow(/gv/);
  });

  it('accepts a ref that went through JSON', () => {
    const item = generate({
      skill: 'inv2',
      difficulty: 2,
      seed: 5,
      target: 'M20_INV2_RECIPE',
      targetVariant: 'NO_DIVIDE',
    });
    expect(regenerate(JSON.parse(JSON.stringify(item.ref)))).toEqual(item);
  });
});
