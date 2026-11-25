import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { CONFIG } from '@/lib/config';
import { answersEqual } from '@/lib/core/classify';
import { Rational } from '@/lib/core/rational';
import { Surd } from '@/lib/core/surd';
import { sceneDurationMs, sceneLimitMs } from '@/lib/topics/matrix/scenes';
import type { AnyScene } from '@/lib/topics/matrix/scenes/types';
import { voiceText } from '@/lib/topics/matrix/scenes/voice';
import { generate } from '../generators';
import { CATALOG, sceneFor } from '../misconceptions';
import { cross, dot, vec } from '../ops';
import { SKILLS, levelsOf } from '../skills';
import {
  VECTOR_UNITS,
  conceptExample,
  conceptScene,
  introScene,
  remediationScene,
  revealScene,
  vectorScenes,
  type VectorScene,
} from '.';
import { angleScene } from './angleFan';
import { areaScene } from './areaVolume';
import { VECTOR_SCENE_COMBOS, vectorCaughtExample } from './catalog';
import { componentScene } from './componentSteps';
import { crossScene } from './crossCover';
import { dotScene } from './dotPairs';
import { magnitudeScene } from './magnitudeBox';
import { parallelScene } from './parallelScale';
import { unitScene } from './unitShrink';

const SEEDS = Array.from({ length: 24 }, (_, i) => i * 7919 + 1);

// Thai vowels above and below the line and tone marks take no width of their own. 360px leaves room
// for 44 of the rest at the caption's size, as measured for the matrix clips (scenes.test.ts there).
const THAI_MARKS = /[ัิ-ฺ็-๎]/g;
const spacingLength = (text: string) => text.replace(THAI_MARKS, '').length;
const MAX_CAPTION_SPACING = 44;
const TONE_MARK = /\[[rcw]:([^\]]*)\]/g;

/** Every beat plays, every caption is filled and fits, and the clip keeps to its limit. */
function expectPlayable(spec: VectorScene) {
  const scene = spec as unknown as AnyScene;
  expect(scene.beats.length).toBeGreaterThan(0);
  expect(new Set(scene.beats).size).toBe(scene.beats.length);
  for (const beat of scene.beats) {
    const ms = scene.beatMs[beat];
    expect(ms, beat).toBeGreaterThan(0);
    expect(ms, beat).toBeLessThanOrEqual(CONFIG.scenes.maxBeatMs);
    const id = scene.voice[beat];
    expect(id, `${spec.template}.${beat} has a line`).toBeDefined();
    expect(voiceText(id!)).toBeTruthy();
    const caption = scene.captions[beat];
    if (spec.template !== 'worked_solution') expect(caption, `${beat} caption`).toBeTruthy();
    if (caption) {
      expect(caption).not.toMatch(/[{}]/);
      const lines = caption.replace(TONE_MARK, '$1').split('\n');
      expect(lines.length).toBeLessThanOrEqual(2);
      for (const line of lines) {
        expect(spacingLength(line), line).toBeLessThanOrEqual(MAX_CAPTION_SPACING);
      }
    }
  }
  for (const beat of scene.waits ?? []) {
    expect(scene.beats).toContain(beat);
    expect(scene.hints?.[beat]?.caption).toBeTruthy();
    expect(voiceText(scene.hints![beat]!.voice)).toBeTruthy();
  }
  if (scene.flagged) expect(scene.beats).toContain(scene.flagged);
  expect(sceneDurationMs(scene)).toBeLessThanOrEqual(sceneLimitMs(spec.purpose));
}

/** The text a template is handed, where every number on screen comes from. */
const textOf = (spec: VectorScene): string => JSON.stringify(spec.params);

describe('every vector misconception has a clip with numbers from the generator', () => {
  it('covers all 26 misconceptions and every row of VECTORS §4.1', () => {
    expect(new Set(VECTOR_SCENE_COMBOS.map((combo) => combo.id)).size).toBe(26);
    expect(VECTOR_SCENE_COMBOS).toHaveLength(55);
  });

  it.each(VECTOR_SCENE_COMBOS.map((combo) => [`${combo.id} L${combo.level}`, combo] as const))(
    '%s opens on the student’s answer and plays within its limit',
    (_, combo) => {
      let built = 0;
      for (const seed of SEEDS) {
        const caught = vectorCaughtExample(combo, seed);
        if (!caught) continue;
        built += 1;
        const { spec, answer } = caught;
        expect(spec.purpose).toBe('remediate');
        expect(spec.template).toBe(sceneFor(combo.id).template);
        expectPlayable(spec);
        // Compare mode: it opens on what they answered, and asks once, with a hint for a wrong tap.
        expect(spec.beats[0]).toBe('compare');
        expect(spec.flagged).toBe('compare');
        expect(spec.compare?.studentAnswer).toEqual(answer);
        expect(spec.waits).toEqual(['try']);
        const question = (spec.params as { try?: { options: string[]; right: number } }).try;
        expect(question?.options.length).toBeGreaterThanOrEqual(2);
        expect(new Set(question!.options).size).toBe(question!.options.length);
        expect(question!.right).toBeLessThan(question!.options.length);
      }
      expect(built).toBeGreaterThan(SEEDS.length / 2);
    },
  );

  it('holds across seeds', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...VECTOR_SCENE_COMBOS),
        fc.integer({ min: 0, max: 0x7fffffff }),
        (combo, seed) => {
          const caught = vectorCaughtExample(combo, seed);
          if (caught) expectPlayable(caught.spec);
        },
      ),
      { numRuns: 300 },
    );
  });

  it('is pure: the same item and answer build the same clip', () => {
    for (const combo of VECTOR_SCENE_COMBOS) {
      const caught = vectorCaughtExample(combo, 20261124);
      if (!caught) continue;
      const again = remediationScene(caught.item, caught.answer, caught.caught);
      expect(JSON.stringify(again)).toBe(JSON.stringify(caught.spec));
    }
  });

  it('writes the student’s own answer on the clip', () => {
    for (const combo of VECTOR_SCENE_COMBOS) {
      const caught = vectorCaughtExample(combo, 7);
      if (!caught) continue;
      const params = caught.spec.params as { student?: unknown };
      expect(params.student, combo.id).toBeDefined();
    }
  });
});

describe('every vector skill has a concept clip', () => {
  const skillLevels = SKILLS.flatMap(({ id }) => levelsOf(id).map((level) => ({ id, level })));

  it.each(skillLevels)(
    '$id at L$level plays within 22 s, with no compare beat',
    ({ id, level }) => {
      for (const seed of SEEDS) {
        const spec = conceptScene(id, { seed, level });
        expect(spec.purpose).toBe('concept');
        expectPlayable(spec);
        expect(spec.beats as string[]).not.toContain('compare');
        expect(spec.waits).toBeUndefined();
        expect(spec.compare).toBeUndefined();
      }
    },
  );

  it('never shows the item being worked on, nor its answer', () => {
    for (const { id, level } of skillLevels) {
      for (const seed of SEEDS.slice(0, 6)) {
        const open = generate({ skill: id, difficulty: level, seed });
        const example = conceptExample(id, { seed, level, avoid: open });
        expect(JSON.stringify(example.data)).not.toBe(JSON.stringify(open.data));
        if (open.kind !== 'choice') expect(answersEqual(example.correct, open.correct)).toBe(false);
      }
    }
  });

  it('is deterministic, and a new seed gives a new example', () => {
    for (const { id } of SKILLS) {
      const once = JSON.stringify(conceptScene(id, { seed: 5 }));
      expect(JSON.stringify(conceptScene(id, { seed: 5 }))).toBe(once);
    }
    const shown = new Set(
      SEEDS.map((seed) => JSON.stringify(conceptScene('v_dot', { seed }).params)),
    );
    expect(shown.size).toBeGreaterThan(SEEDS.length / 2);
  });

  it('can be asked for as a request, through the pack', () => {
    const open = generate({ skill: 'v_cross', difficulty: 2, seed: 9 });
    const spec = vectorScenes.concept('v_cross', {
      seed: 3,
      level: 2,
      avoid: open,
      purpose: 'request',
    });
    expect(spec.purpose).toBe('request');
    expect(spec.template).toBe('cross_cover');
  });
});

describe('unit intros', () => {
  it.each(VECTOR_UNITS.map((unit) => [unit] as const))(
    'unit %s plays within 40 s for any student',
    (unit) => {
      for (const seed of [undefined, ...SEEDS]) {
        const spec = introScene(unit, { seed });
        expect(spec.purpose).toBe('intro');
        expectPlayable(spec);
      }
    },
  );

  it('use the templates of VECTORS §5', () => {
    expect(VECTOR_UNITS.map((unit) => introScene(unit).template)).toEqual([
      'quantity_sort',
      'component_steps',
      'magnitude_box',
      'dot_pairs',
      'cross_cover',
    ]);
  });

  it('give each student their own example, the same every time', () => {
    for (const unit of VECTOR_UNITS) {
      expect(JSON.stringify(introScene(unit, { seed: 1 }))).toBe(
        JSON.stringify(introScene(unit, { seed: 1 })),
      );
    }
    const shown = new Set(SEEDS.map((seed) => JSON.stringify(introScene(12, { seed }).params)));
    expect(shown.size).toBeGreaterThan(SEEDS.length / 2);
  });

  it('goes through the pack', () => {
    expect(vectorScenes.intro(15, { seed: 4 }).template).toBe('cross_cover');
  });
});

describe('reveal clips ("ดูวิธีทำ")', () => {
  it('open every item of every skill in at most six taps, every step with a line', () => {
    for (const { id } of SKILLS) {
      for (const level of levelsOf(id)) {
        for (const seed of SEEDS.slice(0, 8)) {
          const item = generate({ skill: id, difficulty: level, seed });
          const spec = revealScene(item);
          expect(spec.template).toBe('worked_solution');
          expect(spec.purpose).toBe('reveal');
          expect(spec.beats.length).toBeLessThanOrEqual(6);
          expectPlayable(spec);
          expect(vectorScenes.reveal(item)).toEqual(spec);
        }
      }
    }
  });

  it('no vector mistake opens a worked solution in place of its own clip', () => {
    for (const { id } of CATALOG) {
      expect(vectorScenes.hasWorkedScene({ id }, 'vector')).toBe(false);
    }
  });
});

describe('the documented examples of VECTORS §4 on screen', () => {
  const remediate = { purpose: 'remediate' as const };

  it('V05: AB = B − A = (3, 4, −4) and the student had (−3, −4, 4)', () => {
    const spec = componentScene({
      mode: 'points',
      A: vec(1, -2, 3),
      B: vec(4, 2, -1),
      ...remediate,
      studentAnswer: { kind: 'vector', value: [-3, -4, 4].map((n) => Surd.rational(n)) },
    });
    expect(spec.params.lines).toEqual(['4 − 1 = 3', '2 − (−2) = 4', '−1 − 3 = −4']);
    expect(spec.captions.compare).toContain('(−3, −4, 4)');
    expect(spec.captions.done).toContain('(3, 4, −4)');
  });

  it('V06 and V07: 3u − 2v = (4, −11, 13), scaling every component', () => {
    const terms = [
      { k: 3, name: 'u' as const, vec: vec(2, -1, 3) },
      { k: -2, name: 'v' as const, vec: vec(1, 4, -2) },
    ];
    const spec = componentScene({
      mode: 'linear',
      terms,
      notation: 'tuple',
      ...remediate,
      studentAnswer: { kind: 'vector', value: [4, -5, 5].map((n) => Surd.rational(n)) },
      caught: 'V06_SCALAR_PARTIAL',
    });
    expect(spec.params.terms![1].lines).toEqual(['−2 · 1 = −2', '−2 · 4 = −8', '−2 · (−2) = 4']);
    expect(spec.params.lines).toEqual(['6 + (−2) = 4', '−3 + (−8) = −11', '9 + 4 = 13']);
    const combo = componentScene({
      mode: 'linear',
      terms,
      notation: 'tuple',
      ...remediate,
      studentAnswer: { kind: 'vector', value: [8, 5, 5].map((n) => Surd.rational(n)) },
      caught: 'V07_COMBO_SIGN',
    });
    expect(combo.params.try?.options).toContain('(−2, −8, 4)');
    expect(combo.params.try?.options).toContain('(2, 8, −4)');
  });

  it('V08: u = (2/3)v gives m = 4, and the flipped ratio 9', () => {
    const spec = parallelScene({
      data: {
        form: 'parallel',
        u: [Rational.of(2), 'm', Rational.of(-4)],
        v: [3, 6, -6].map((n) => Rational.of(n)),
        ask: 'm',
      },
      ...remediate,
      studentAnswer: { kind: 'scalar', value: Rational.of(9) },
    });
    expect(spec.params.kLine).toBe('2 = k · 3  →  k = 2/3');
    expect(spec.params.solveLine).toBe('m = 2/3 · 6 = 4');
    expect(spec.params.wrongLine).toBe('m = 6 ÷ 2/3 = 9');
  });

  it('V09 and V10: |(1, −4, 1)| = √18 = 3√2, against 18 and 6', () => {
    const data = { form: 'magnitude' as const, v: vec(1, -4, 1) };
    const spec = magnitudeScene({
      data,
      ...remediate,
      caught: 'V10_MAG_SUM_COMPONENTS',
      studentAnswer: { kind: 'surd', value: Surd.rational(6) },
    });
    expect(spec.params.squaresLine).toBe('1² + (−4)² + 1² = 18');
    expect(spec.params.rootLine).toBe('√18 = 3√2');
    expect(spec.params.walkLine).toBe('|1| + |−4| + |1| = 6');
    expect(spec.params.floor?.line).toBe('√(1² + (−4)²) = √17');
  });

  it('V11: |u + v| = 3√6 for u = (2, 1, 2), v = (0, 4, 3), against 3 + 5 = 8', () => {
    const spec = magnitudeScene({
      data: {
        form: 'magnitude_combo',
        terms: [
          { k: 1, name: 'u', vec: vec(2, 1, 2) },
          { k: 1, name: 'v', vec: vec(0, 4, 3) },
        ],
      },
      ...remediate,
      caught: 'V11_MAG_ADDITIVE',
      studentAnswer: { kind: 'surd', value: Surd.rational(8) },
    });
    expect(spec.params.sumLine).toBe('|u| + |v| = 3 + 5 = 8');
    expect(spec.params.rootLine).toBe('√54 = 3√6');
  });

  it('V12: (1, 2, 2) over 3 is (1/3, 2/3, 2/3), and over 9 is a third as long', () => {
    const spec = unitScene({
      data: { form: 'unit', v: vec(1, 2, 2) },
      ...remediate,
      studentAnswer: {
        kind: 'vector',
        value: [Rational.of(1, 9), Rational.of(2, 9), Rational.of(2, 9)].map((q) =>
          Surd.rational(q),
        ),
      },
    });
    expect(spec.params.normLine).toBe('|v| = √(1² + 2² + 2²) = 3');
    expect(spec.params.checkLine).toBe('(1/3)² + (2/3)² + (2/3)² = 1');
    expect(spec.params.studentCheck).toBe('1/3');
    expect(spec.params.try?.options).toEqual(expect.arrayContaining(['|v| = 3', '|v|² = 9']));
  });

  it('V14: (3, −2)·(4, 5) = 12 + (−10) = 2, against 23', () => {
    const spec = dotScene({
      data: { form: 'dot', u: vec(3, -2), v: vec(4, 5) },
      ...remediate,
      studentAnswer: { kind: 'surd', value: Surd.rational(23) },
    });
    expect(spec.params.sumLine).toBe('u · v = 12 + (−10) = 2');
    expect(spec.params.wrongLine).toBe('3·5 − (−2)·4 = 23');
    expect(spec.params.sign).toBe('acute');
  });

  it('V15 and V16: 4 · 6 · cos 60° = 12; sin gives 12√3', () => {
    const data = {
      form: 'dot_polar' as const,
      normU: Surd.rational(4),
      normV: Surd.rational(6),
      theta: 60 as const,
    };
    const spec = dotScene({
      data,
      ...remediate,
      caught: 'V16_DOT_SIN',
      studentAnswer: { kind: 'surd', value: Surd.of(12, 3) },
    });
    expect(spec.params.sumLine).toBe('u · v = 4 · 6 · 1/2 = 12');
    expect(spec.params.wrongLine).toBe('4 · 6 · sin 60° = 12√3');
  });

  it('V19: (2, k, −1) ⊥ (3, 1, 4) gives k = −2, and the ratio 2/3', () => {
    const spec = dotScene({
      data: {
        form: 'perp',
        u: [Rational.of(2), 'k', Rational.of(-1)],
        v: [3, 1, 4].map((n) => Rational.of(n)),
      },
      ...remediate,
      studentAnswer: { kind: 'scalar', value: Rational.of(2, 3) },
    });
    expect(spec.params.equationLine).toBe('6 + k + (−4) = 0');
    expect(spec.params.solveLine).toBe('k = −2  →  k = −2');
    expect(spec.params.wrongLine).toBe('2/3 = k/1  →  k = 2/3');
  });

  it('V17: u = (1, 1, 0), v = (−1, 0, 1) make 120°, read wrongly as 60°', () => {
    const spec = angleScene({
      data: { form: 'angle', u: vec(1, 1, 0), v: vec(-1, 0, 1), theta: 120 },
      ...remediate,
      studentAnswer: { kind: 'scalar', value: Rational.of(60) },
    });
    expect(spec.params.cosLine).toBe('cos θ = −1/(√2 · √2) = −1/2');
    expect(spec.params.theta).toBe(120);
    expect(spec.params.mirror).toBe(60);
  });

  it('V18: cos θ = 5/√50 = √2/2, against 5/(5 · 10) = 1/10', () => {
    const spec = angleScene({
      data: { form: 'cos_angle', u: vec(1, 2), v: vec(3, 1) },
      ...remediate,
      caught: 'V18_ANGLE_SQUARED_NORMS',
      studentAnswer: { kind: 'surd', value: Surd.rational(Rational.of(1, 10)) },
    });
    expect(spec.params.cosLine).toBe('cos θ = 5/(√5 · √10) = √2/2');
    expect(spec.params.wrongLine).toBe('5/(5 · 10) = 1/10');
    expect(spec.params.theta).toBe(45);
  });

  it('V20–V22: (2, −1, 3) × (1, 4, −2) = (−10, 7, 9), at right angles to both', () => {
    const u = vec(2, -1, 3);
    const v = vec(1, 4, -2);
    const spec = crossScene({
      data: { form: 'cross', u, v, order: 'uv' },
      ...remediate,
      caught: 'V22_CROSS_COMPONENTWISE',
      studentAnswer: { kind: 'vector', value: [2, -4, -6].map((n) => Surd.rational(n)) },
    });
    expect(spec.params.lines).toEqual([
      '(−1)·(−2) − 3·4 = −10',
      '−(2·(−2) − 3·1) = 7',
      '2·4 − (−1)·1 = 9',
    ]);
    expect(spec.params.checkLines).toEqual([
      '(u × v) · u = −20 + (−7) + 27 = 0',
      '(u × v) · v = −10 + 28 + (−18) = 0',
    ]);
    expect(dot(cross(u, v), u).isZero()).toBe(true);
    expect(spec.params.studentCheck).toBe('4 + 4 + (−18) = −10');
  });

  it('V23 and V24: triangle (1,0,1), (2,2,1), (4,1,3) has area 3√5/2', () => {
    const spec = areaScene({
      data: { form: 'area_triangle', A: vec(1, 0, 1), B: vec(2, 2, 1), C: vec(4, 1, 3) },
      ...remediate,
      caught: 'V24_AREA_DOT',
      studentAnswer: { kind: 'surd', value: Surd.rational(Rational.of(5, 2)) },
    });
    expect(spec.params.crossLine).toBe('AB × AC = (4, −2, −5)');
    expect(spec.params.normLine).toBe('|AB × AC| = √(16 + 4 + 25) = 3√5');
    expect(spec.params.halfLine).toBe('½ · 3√5 = 3√5/2');
    expect(spec.params.wrongLine).toBe('½ |AB · AC| = 5/2');
  });

  it('V25 and V26: u · (v × w) = −13, so the volume is 13; |u||v||w| = 5√10', () => {
    const spec = areaScene({
      data: { form: 'volume', u: vec(1, 2, 0), v: vec(2, 0, 1), w: vec(0, 1, 3) },
      ...remediate,
      caught: 'V26_VOLUME_MAG_PRODUCT',
      studentAnswer: { kind: 'surd', value: Surd.of(5, 10) },
    });
    expect(spec.params.crossLine).toBe('v × w = (−1, −6, 2)');
    expect(spec.params.dotLine).toBe('u · (v × w) = −1 + (−12) + 0 = −13');
    expect(spec.params.productLine).toBe('|u||v||w| = √5 · √5 · √10 = 5√10');
    expect(spec.params.right).toBe('13');
  });
});

describe('every number a clip writes is the engine’s', () => {
  it('shows only numbers its item holds or works out, as exact text', () => {
    for (const combo of VECTOR_SCENE_COMBOS) {
      const caught = vectorCaughtExample(combo, 11);
      if (!caught) continue;
      // No float ever reaches the text a student reads.
      expect(textOf(caught.spec)).not.toMatch(/\d\.\d/);
      for (const caption of Object.values(caught.spec.captions)) {
        expect(caption ?? '').not.toMatch(/\d\.\d/);
      }
    }
  });
});
