'use client';

import { LazyMotion, domAnimation } from 'motion/react';
import { useMemo } from 'react';
import { STAGE_ASPECT } from '@/components/clip/kit';
import { SceneStage } from '@/components/scenes/SceneStage';
import { BeatClockContext } from '@/components/scenes/svg';
import { th } from '@/lib/content/th';
import type { AnyScene } from '@/lib/topics/matrix/scenes/types';
import { vectorSections } from '../vectorEntries';

const STILL = { ms: 2000, still: true };

/** Every beat of each vector clip, still, under its caption. `only` keeps one clip, by its key. */
export function FramesPreview({ only, seed }: { only?: string; seed: number }) {
  const sections = useMemo(() => vectorSections(seed), [seed]);
  return (
    <LazyMotion features={domAnimation}>
      <BeatClockContext.Provider value={STILL}>
        <main className="board min-h-dvh w-full px-4 pt-6 pb-10">
          <h1 className="mb-4 text-xl font-semibold">{th.clip.preview.title}</h1>
          {sections.map((section) => (
            <section key={section.title} className="mb-8 flex flex-col gap-6">
              <h2 className="font-hand text-lg text-cta">{section.title}</h2>
              {section.entries
                .filter((entry) => only === undefined || entry.key === only)
                .map((entry) => {
                  const scene = entry.spec as unknown as AnyScene;
                  return (
                    <article key={entry.key} id={entry.key} className="flex flex-col gap-2">
                      <h3 className="font-medium">
                        <a href={`?k=${encodeURIComponent(entry.key)}&seed=${seed}`}>
                          {entry.title}
                        </a>
                      </h3>
                      <ol className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
                        {scene.beats.map((beat) => (
                          <li
                            key={beat}
                            className="flex flex-col gap-1 rounded-lg border border-line p-2"
                          >
                            <div
                              className="w-full"
                              style={
                                entry.spec.template === 'worked_solution'
                                  ? undefined
                                  : { aspectRatio: STAGE_ASPECT }
                              }
                            >
                              <SceneStage spec={entry.spec} beat={beat} />
                            </div>
                            <p className="text-center font-hand whitespace-pre-line">
                              {(scene.captions[beat] ?? '').replace(/\[[rcw]:([^\]]*)\]/g, '$1')}
                            </p>
                          </li>
                        ))}
                      </ol>
                    </article>
                  );
                })}
            </section>
          ))}
        </main>
      </BeatClockContext.Provider>
    </LazyMotion>
  );
}
