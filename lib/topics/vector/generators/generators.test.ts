import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { thVector } from '@/lib/content/th.vector';
import { classify } from '@/lib/core/classify';
import { deriveSeed } from '@/lib/core/prng';
import { Rational } from '@/lib/core/rational';
import { Surd } from '@/lib/core/surd';
import type { Answer, Level } from '@/lib/core/types';
import { figureKey } from '../format';
import { CATALOG, probeLevels, variantsOf } from '../misconceptions';
import { dot, triple } from '../ops';
import { givenNumbers, validateVectorItem, VECTOR_LIMITS } from '../rules';
import { SKILLS, levelsOf, type SkillId } from '../skills';
import { askedValue, exprValue, QUANTITY_KIND, termValue } from '../solve';
import type { GenerateRequest, VectorItem } from '../types';
import { generate, generateDetailed, MAX_TRIES, regenerate, VECTOR_GENERATOR_VERSION } from '.';

const seedArb = fc.integer({ min: 0, max: 0xffffffff });

const SKILL_LEVELS: [SkillId, Level][] = SKILLS.flatMap(({ id }) =>
  levelsOf(id).map((level): [SkillId, Level] => [id, level]),
);

const answerSurds = (answer: Answer): Surd[] => {
  switch (answer.kind) {
    case 'surd':
      return [answer.value];
    case 'vector':
      return answer.value;
    case 'scalar':
      return [Surd.rational(answer.value)];
    default:
      return [];
  }
};

/** The number limits of docs/VECTORS.md §2, checked here apart from rules.ts. */
function expectWithinLimits(item: VectorItem) {
  for (const given of givenNumbers(item.data)) {
    expect(Math.abs(given.n)).toBeLessThanOrEqual(VECTOR_LIMITS.component);
    expect(given.isInteger()).toBe(true);
  }
  if (item.data.form === 'angle') return;
  for (const value of answerSurds(item.correct)) {
    expect(value.square().compare(Rational.of(150 * 150))).toBeLessThanOrEqual(0);
    expect(value.radicand).toBeLessThanOrEqual(200);
    expect(value.coeff.d).toBeLessThanOrEqual(12);
  }
}

/** Every option is labelled, names a different vector, and the answer is the only one that fits. */
function expectChoicesConsistent(item: VectorItem) {
  if (item.kind !== 'choice') {
    expect(item.options).toBeUndefined();
    return;
  }
  const options = item.options ?? [];
  const ids = options.map((option) => option.id);
  expect(new Set(ids).size).toBe(ids.length);
  for (const option of options) {
    expect(option.labelKey).toBe(option.id);
    expect(thVector.choices[option.labelKey].length).toBeGreaterThan(0);
  }
  if (item.correct.kind !== 'choice') throw new Error('a choice item answers a choice');
  expect(ids).toContain(item.correct.id);
  for (const diagnostic of item.diagnostics) {
    expect(diagnostic.answer.kind).toBe('choice');
    if (diagnostic.answer.kind === 'choice') expect(ids).toContain(diagnostic.answer.id);
  }
  const { data } = item;
  if (data.form === 'quantity_kind') {
    expect(data.options.filter((q) => QUANTITY_KIND[q] === data.ask)).toHaveLength(1);
    return;
  }
  if (data.form !== 'figure_equal' && data.form !== 'figure_expr') {
    throw new Error(`unexpected choice form ${data.form}`);
  }
  const asked = data.form === 'figure_equal' ? askedValue(data) : exprValue(data.figure, data.expr);
  const fits = data.options.filter((option) =>
    termValue(data.figure, option).every((part, i) => part.equals(asked[i])),
  );
  expect(fits.map(figureKey)).toEqual([item.correct.id]);
}

/** Every generated item must be valid, correct, self-classifying and within limits. */
function expectSound(item: VectorItem) {
  expect(validateVectorItem(item)).toEqual({ ok: true });
  expect(classify(item, item.correct)).toEqual({ type: 'correct' });
  for (const diagnostic of item.diagnostics) {
    if (diagnostic.answer.kind === 'any_matrix') throw new Error('no ANY_MATRIX in vectors');
    const expected =
      diagnostic.variant === undefined
        ? { type: 'misconception', id: diagnostic.id }
        : { type: 'misconception', id: diagnostic.id, variant: diagnostic.variant };
    expect(classify(item, diagnostic.answer)).toEqual(expected);
  }
  expectWithinLimits(item);
  expectChoicesConsistent(item);
  if (item.kind === 'vector' && item.correct.kind === 'vector') {
    expect(item.grid).toEqual({ rows: item.correct.value.length, cols: 1 });
  } else {
    expect(item.grid).toBeUndefined();
  }
  if (item.data.form === 'cross' && item.correct.kind === 'vector') {
    const answer = item.correct.value.map((part) => part.toRational());
    expect(dot(answer, item.data.u).isZero()).toBe(true);
    expect(dot(answer, item.data.v).isZero()).toBe(true);
  }
}

describe('every skill × level', () => {
  it.each(SKILL_LEVELS)(
    '%s L%i is valid, correct, within limits and self-classifying',
    (skill, difficulty) => {
      fc.assert(
        fc.property(seedArb, (seed) => {
          expectSound(generate({ skill, difficulty, seed }));
        }),
      );
    },
  );

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
    expect(item.ref).toEqual({ topic: 'vector', skill, difficulty, seed: 123, gv: 1 });
  });

  it.each(SKILL_LEVELS)('%s L%i works for seeds from deriveSeed', (skill, difficulty) => {
    for (let counter = 0; counter < 200; counter += 1) {
      const seed = deriveSeed('00000000-0000-4000-8000-000000000000', counter);
      expectSound(generate({ skill, difficulty, seed }));
    }
  });
});

describe('slip and shape_error on vector items', () => {
  const VECTOR_SKILL_LEVELS = SKILL_LEVELS.filter(
    ([skill, difficulty]) => generate({ skill, difficulty, seed: 1 }).kind === 'vector',
  );

  it('covers every skill whose answer is a vector', () => {
    expect([...new Set(VECTOR_SKILL_LEVELS.map(([skill]) => skill))].sort()).toEqual(
      ['v_cross', 'v_linear', 'v_points', 'v_unit'].sort(),
    );
  });

  it.each(VECTOR_SKILL_LEVELS)(
    '%s L%i: one wrong component is a slip at that component',
    (skill, difficulty) => {
      fc.assert(
        fc.property(seedArb, fc.nat(), (seed, pick) => {
          const item = generate({ skill, difficulty, seed });
          if (item.correct.kind !== 'vector') return;
          const value = [...item.correct.value];
          const i = pick % value.length;
          value[i] = value[i].addSame(Surd.ONE) ?? Surd.ONE.neg();
          expect(classify(item, { kind: 'vector', value })).toEqual({
            type: 'slip',
            cell: [i + 1, 1],
          });
        }),
      );
    },
  );

  it.each(VECTOR_SKILL_LEVELS)('%s L%i: a wrong size is a shape_error', (skill, difficulty) => {
    fc.assert(
      fc.property(seedArb, (seed) => {
        const item = generate({ skill, difficulty, seed });
        if (item.correct.kind !== 'vector') return;
        const wrong = [...item.correct.value, Surd.ONE];
        expect(classify(item, { kind: 'vector', value: wrong })).toEqual({ type: 'shape_error' });
      }),
    );
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
  const SAMPLE = 1000;

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
    // v_unit L1 is 2D with a whole length and squares within 60: only (±3, ±4) and (±4, ±3).
    const atLeast = skill === 'v_unit' && difficulty === 1 ? 8 : 20;
    expect(seen.size).toBeGreaterThanOrEqual(atLeast);
  });

  it('two students get different items from the same step', () => {
    const items = Array.from({ length: 40 }, (_, seat) =>
      JSON.stringify(
        generate({ skill: 'v_cross', difficulty: 2, seed: deriveSeed(`student-${seat}`, 5) }).data,
      ),
    );
    expect(new Set(items).size).toBe(40);
  });
});

describe('levels mix what docs/VECTORS.md §2 says they mix', () => {
  function tally(request: Omit<GenerateRequest, 'seed'>, key: (item: VectorItem) => string) {
    const counts = new Map<string, number>();
    for (let seed = 0; seed < 400; seed += 1) {
      const label = key(generate({ ...request, seed: seed * 7919 }));
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
    return counts;
  }

  it('v_quantity L1 asks for vectors and for scalars', () => {
    const counts = tally({ skill: 'v_quantity', difficulty: 1 }, (item) => item.prompt.key);
    expect(counts.get('quantity_vector')).toBeGreaterThan(100);
    expect(counts.get('quantity_scalar')).toBeGreaterThan(100);
  });

  it.each<Level>([2, 3])(
    'v_quantity L%i asks for equal vectors and for negatives',
    (difficulty) => {
      const counts = tally({ skill: 'v_quantity', difficulty }, (item) => item.prompt.key);
      expect(counts.get('figure_equal')).toBeGreaterThan(100);
      expect(counts.get('figure_negative')).toBeGreaterThan(50);
    },
  );

  it('v_geom L2 mixes sums and differences', () => {
    const counts = tally({ skill: 'v_geom', difficulty: 2 }, (item) =>
      item.data.form === 'figure_expr' && item.data.expr[1].k.sign() < 0 ? 'sub' : 'add',
    );
    expect(counts.get('add')).toBeGreaterThan(100);
    expect(counts.get('sub')).toBeGreaterThan(100);
  });

  it('v_linear L1 mixes u + v in 2D and ku in 3D', () => {
    const counts = tally({ skill: 'v_linear', difficulty: 1 }, (item) =>
      item.data.form === 'linear'
        ? `${item.data.terms.length}:${item.data.terms[0].vec.length}`
        : '',
    );
    expect(counts.get('2:2')).toBeGreaterThan(100);
    expect(counts.get('1:3')).toBeGreaterThan(100);
  });

  it('v_magnitude L3 mixes |pu + qv| and distances', () => {
    const counts = tally({ skill: 'v_magnitude', difficulty: 3 }, (item) => item.data.form);
    expect(counts.get('magnitude_combo')).toBeGreaterThan(100);
    expect(counts.get('distance')).toBeGreaterThan(100);
  });

  it('v_unit L3 mixes unit vectors, scaled ones and direction cosines', () => {
    const counts = tally({ skill: 'v_unit', difficulty: 3 }, (item) => item.data.form);
    for (const form of ['unit', 'scaled_unit', 'direction_cosines']) {
      expect(counts.get(form)).toBeGreaterThan(80);
    }
  });

  it('v_angle draws every angle its level lists', () => {
    const two = tally({ skill: 'v_angle', difficulty: 2 }, (item) =>
      item.correct.kind === 'scalar' ? item.correct.value.toString() : '',
    );
    expect([...two.keys()].sort()).toEqual(['120', '135', '30', '45', '60', '90']);
    const three = tally({ skill: 'v_angle', difficulty: 3 }, (item) =>
      item.correct.kind === 'scalar' ? item.correct.value.toString() : '',
    );
    expect([...three.keys()].sort()).toEqual(['120', '135', '150']);
  });

  it('v_dot L3 draws every standard angle', () => {
    const counts = tally({ skill: 'v_dot', difficulty: 3 }, (item) =>
      item.data.form === 'dot_polar' ? String(item.data.theta) : '',
    );
    expect(counts.size).toBe(9);
  });

  it('v_volume L2 is always negative before the absolute value, and L1 mixes both signs', () => {
    const sign = (item: VectorItem) =>
      item.data.form === 'volume'
        ? String(triple(item.data.u, item.data.v, item.data.w).sign())
        : '';
    expect([...tally({ skill: 'v_volume', difficulty: 2 }, sign).keys()]).toEqual(['-1']);
    const one = tally({ skill: 'v_volume', difficulty: 1 }, sign);
    expect(one.get('-1')).toBeGreaterThan(100);
    expect(one.get('1')).toBeGreaterThan(50);
  });

  it('v_cross asks v × u only at L3', () => {
    for (const difficulty of [1, 2, 3] as const) {
      const counts = tally({ skill: 'v_cross', difficulty }, (item) => item.prompt.key);
      expect([...counts.keys()]).toEqual([difficulty === 3 ? 'cross_vu' : 'cross_uv']);
    }
  });

  it('v_area L3 lies in the xy-plane, where the answer is ½|ad − bc|', () => {
    for (let seed = 0; seed < 200; seed += 1) {
      const item = generate({ skill: 'v_area', difficulty: 3, seed });
      if (item.data.form !== 'area_triangle' || item.correct.kind !== 'surd')
        throw new Error('form');
      const { A, B, C } = item.data;
      const [a, b] = [B[0].sub(A[0]), B[1].sub(A[1])];
      const [c, d] = [C[0].sub(A[0]), C[1].sub(A[1])];
      const half = a.mul(d).sub(b.mul(c)).abs().div(Rational.of(2));
      expect(item.correct.value).toEqual(Surd.rational(half));
    }
  });

  it('every L1 and L2 skill except v_dot L2 can catch something', () => {
    for (const [skill, difficulty] of SKILL_LEVELS) {
      const caught = Array.from(
        { length: 50 },
        (_, seed) => generate({ skill, difficulty, seed }).diagnostics.length,
      ).some((count) => count > 0);
      const silent =
        (skill === 'v_dot' && difficulty === 2) ||
        (skill === 'v_geom' && difficulty === 1) ||
        (skill === 'v_points' && difficulty === 3) ||
        (skill === 'v_perp' && difficulty === 3);
      expect(caught, `${skill} L${difficulty}`).toBe(!silent);
    }
  });
});

describe('generate guards', () => {
  it('has its own generator version, apart from the matrix pack', () => {
    expect(VECTOR_GENERATOR_VERSION).toBe(1);
  });

  it('has no L3 for v_volume (☆)', () => {
    expect(() => generate({ skill: 'v_volume', difficulty: 3, seed: 1 })).toThrow(/v_volume/);
  });

  it('rejects a non-integer seed', () => {
    expect(() => generate({ skill: 'v_dot', difficulty: 1, seed: 1.5 })).toThrow(/seed/);
  });

  it('rejects a variant with no target', () => {
    expect(() =>
      generate({ skill: 'v_dot', difficulty: 1, seed: 1, targetVariant: 'ANY' }),
    ).toThrow(/target/);
  });

  it('survives seeds at the top of the range, where seed + tries wraps', () => {
    for (const [skill, difficulty] of SKILL_LEVELS) {
      const item = generate({ skill, difficulty, seed: 0xffffffff });
      expect(validateVectorItem(item)).toEqual({ ok: true });
    }
  });
});

describe('regenerate', () => {
  it('throws for a ref from another generator version, rather than returning a different item', () => {
    const { ref } = generate({ skill: 'v_cross', difficulty: 1, seed: 1 });
    expect(() => regenerate({ ...ref, gv: ref.gv + 1 })).toThrow(/gv/);
  });

  it('accepts a ref that went through JSON', () => {
    const item = generate({
      skill: 'v_cross',
      difficulty: 2,
      seed: 5,
      target: 'V20_CROSS_MIDDLE_SIGN',
    });
    expect(regenerate(JSON.parse(JSON.stringify(item.ref)))).toEqual(item);
  });
});
