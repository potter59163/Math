import { LazyMotion, domAnimation } from 'motion/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { SceneSpec } from '@/lib/topics/types';
import { SKILLS, levelsOf } from '@/lib/topics/vector/skills';
import { VECTOR_UNITS, conceptScene, introScene } from '@/lib/topics/vector/scenes';
import { VECTOR_SCENE_COMBOS, vectorCaughtExample } from '@/lib/topics/vector/scenes/catalog';
import { SceneStage } from '../SceneStage';
import { BeatClockContext } from '../svg';

function frame(spec: SceneSpec, beat: string, still = true): string {
  return renderToStaticMarkup(
    <LazyMotion features={domAnimation}>
      <BeatClockContext.Provider value={{ ms: 2000, still }}>
        <SceneStage spec={spec} beat={beat} />
      </BeatClockContext.Provider>
    </LazyMotion>,
  );
}

/** The text a student reads in a frame, with each number split out. */
const numbersIn = (markup: string): string[] =>
  [...markup.replace(/<[^>]*>/g, ' ').matchAll(/\d+/g)].map(([digits]) => digits);

const specs = [
  ...VECTOR_SCENE_COMBOS.flatMap((combo) =>
    [3, 20261124].flatMap((seed) => {
      const caught = vectorCaughtExample(combo, seed);
      return caught && caught.spec.template !== 'worked_solution' ? [caught.spec] : [];
    }),
  ),
  ...SKILLS.flatMap(({ id }) =>
    levelsOf(id).map((level) => conceptScene(id, { seed: 20261124, level })),
  ),
  ...VECTOR_UNITS.map((unit) => introScene(unit)),
] as SceneSpec[];

describe('the vector templates on SceneStage', () => {
  it('draw every beat of every clip, still and moving', () => {
    for (const spec of specs) {
      for (const beat of spec.beats) {
        expect(frame(spec, beat).length).toBeGreaterThan(0);
        expect(frame(spec, beat, false).length).toBeGreaterThan(0);
      }
    }
  });

  it('are pure on spec and beat: the same two draw the same frame (SCENES §2)', () => {
    for (const spec of specs) {
      for (const beat of spec.beats) expect(frame(spec, beat)).toBe(frame(spec, beat));
    }
  });

  it('write only numbers the engine put in the spec, and no float', () => {
    for (const spec of specs) {
      const known = new Set([...JSON.stringify(spec.params).matchAll(/\d+/g)].map(([n]) => n));
      for (const beat of spec.beats) {
        const markup = frame(spec, beat);
        expect(markup.replace(/<[^>]*>/g, ' ')).not.toMatch(/\d\.\d/);
        // 1 is the length of a unit vector, and 0 to 3 name components and axes.
        for (const number of numbersIn(markup)) {
          if (Number(number) > 3) expect(known, `${spec.template} ${beat}`).toContain(number);
        }
      }
    }
  });

  it('keep the same drawing size from beat to beat, so nothing rescales', () => {
    const viewBox = (markup: string) => /viewBox="([^"]+)"/.exec(markup)?.[1];
    for (const spec of specs) {
      const sizes = new Set(spec.beats.map((beat) => viewBox(frame(spec, beat))));
      expect(sizes.size).toBe(1);
    }
  });

  it('put a tap target on the beat that waits for one', () => {
    for (const spec of specs) {
      for (const beat of spec.waits ?? []) expect(frame(spec, beat)).toContain('role="button"');
    }
  });
});
