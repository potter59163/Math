import { LazyMotion, domAnimation } from 'motion/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { conceptScene, introScene, type SceneSpec } from '@/lib/topics/matrix/scenes';
import { SCENE_COMBOS, caughtExample } from '@/lib/topics/matrix/scenes/catalog';
import { SKILLS } from '@/lib/topics/matrix/skills';
import type { AnyScene } from '@/lib/topics/matrix/scenes/types';
import { SceneStage } from './SceneStage';
import { BeatClockContext } from './svg';

function frame(spec: SceneSpec, beat: string, still = true): string {
  return renderToStaticMarkup(
    <LazyMotion features={domAnimation}>
      <BeatClockContext.Provider value={{ ms: 2000, still }}>
        <SceneStage spec={spec} beat={beat} />
      </BeatClockContext.Provider>
    </LazyMotion>,
  );
}

/** The text the student reads in a frame, with each number split out. */
const numbersIn = (markup: string): string[] =>
  [...markup.replace(/<[^>]*>/g, ' ').matchAll(/\d+/g)].map(([digits]) => digits);

const specs: SceneSpec[] = [
  ...SCENE_COMBOS.flatMap((combo) => {
    const caught = caughtExample(combo, 20261113);
    return caught ? [caught.spec] : [];
  }),
  ...SKILLS.map(({ id }) => conceptScene(id, { seed: 20261113 })),
  ...([1, 2, 3, 4, 5] as const).map(introScene),
];

describe('SceneStage', () => {
  it('draws every beat of every scene', () => {
    for (const spec of specs) {
      for (const beat of (spec as AnyScene).beats) {
        expect(frame(spec, beat).length).toBeGreaterThan(0);
      }
    }
  });

  it('is pure on its spec and beat: the same two draw the same frame (SCENES §2)', () => {
    for (const spec of specs) {
      for (const beat of (spec as AnyScene).beats) {
        expect(frame(spec, beat)).toBe(frame(spec, beat));
      }
    }
  });

  it('draws only numbers the engine put in the spec', () => {
    for (const spec of specs) {
      if (spec.template === 'worked_solution' || spec.template === 'dimension_match') continue;
      const known = new Set([...JSON.stringify(spec.params).matchAll(/\d+/g)].map(([n]) => n));
      for (const beat of spec.beats) {
        for (const number of numbersIn(frame(spec, beat))) {
          // The numerator of 1/det is the recipe itself, not a value.
          if (number !== '1') expect(known).toContain(number);
        }
      }
    }
  });

  it('dimension_match counts only as far as the dims of its block', () => {
    for (const spec of specs) {
      if (spec.template !== 'dimension_match') continue;
      const { first, second, result, student, values } = spec.params;
      const dims = [first, second, result, student === 'undefined' ? null : student]
        .flatMap((value) => (value ? [value.rows, value.cols] : []))
        .map(String);
      const known = new Set([
        ...dims,
        ...(values ?? []).flat().flatMap((cell) => cell.toString().match(/\d+/g) ?? []),
      ]);
      const largest = Math.max(first.rows, first.cols);
      for (const beat of spec.beats) {
        for (const number of numbersIn(frame(spec, beat))) {
          if (Number(number) > largest) expect(known).toContain(number);
        }
      }
    }
  });

  it('keeps the same drawing size from beat to beat, so nothing rescales', () => {
    const viewBox = (markup: string) => /viewBox="([^"]+)"/.exec(markup)?.[1];
    for (const spec of specs) {
      if (spec.template === 'worked_solution') continue;
      const sizes = new Set((spec as AnyScene).beats.map((beat) => viewBox(frame(spec, beat))));
      expect(sizes.size).toBe(1);
    }
  });
});
