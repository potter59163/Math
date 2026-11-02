'use client';

import { useMemo, useRef, useState } from 'react';
import { ScenePlayer } from '@/components/scenes/ScenePlayer';
import { sfx, type SoundName } from '@/lib/client/sfx';
import { th } from '@/lib/content/th';
import { fillTokens } from '@/lib/core/tokens';
import type { ThemeId } from '@/lib/learner/types';
import { generate } from '@/lib/topics/matrix/generators';
import { conceptScene, introScene, revealScene, type SceneSpec } from '@/lib/topics/matrix/scenes';
import { SCENE_COMBOS, caughtExample } from '@/lib/topics/matrix/scenes/catalog';
import { SKILLS } from '@/lib/topics/matrix/skills';

const SOUNDS: readonly SoundName[] = ['correct', 'wrong', 'streak', 'done'];
const THEMES: readonly ThemeId[] = ['game', 'shop', 'food', 'music', 'sport'];
const UNITS = [1, 2, 3, 4, 5] as const;
const FIRST_SEED = 7;
const SEEDS_TO_TRY = 200;

interface Entry {
  key: string;
  title: string;
  spec: SceneSpec;
}

/** A student caught in each mistake, with the answer that mistake really gives. */
function caughtEntries(seed: number, theme: ThemeId): Entry[] {
  const seen = new Set<string>();
  return SCENE_COMBOS.flatMap((combo) => {
    const key = `${combo.id}:${combo.variant ?? ''}`;
    if (seen.has(key)) return [];
    for (let nth = seed; nth < seed + SEEDS_TO_TRY; nth += 1) {
      const caught = caughtExample(combo, nth, theme);
      if (caught) {
        seen.add(key);
        return [{ key, title: th.misconceptionNames[combo.id], spec: caught.spec }];
      }
    }
    return [];
  });
}

/** Every clip the app can play, to watch and hear without having to get anything wrong on purpose. */
export function ClipPreview() {
  const [turn, setTurn] = useState(0);
  const [open, setOpen] = useState<string | null>(null);
  const [seen, setSeen] = useState<ReadonlySet<string>>(new Set());
  const skipped = useRef(false);

  const sections = useMemo(() => {
    const seed = FIRST_SEED + turn * 13;
    const theme = THEMES[turn % THEMES.length];
    const copy = th.clip.preview;
    return [
      {
        title: copy.intro,
        entries: UNITS.map((unit) => ({
          key: `intro:${unit}`,
          title: fillTokens(copy.unit, { n: String(unit) }),
          spec: introScene(unit, { seed, theme }) as SceneSpec,
        })),
      },
      {
        title: copy.concept,
        entries: SKILLS.map(({ id }) => ({
          key: `concept:${id}`,
          title: th.skills[id],
          spec: conceptScene(id, { seed, level: 1 }),
        })),
      },
      { title: copy.remediate, entries: caughtEntries(seed, theme) },
      {
        title: copy.worked,
        entries: SKILLS.map(({ id }) => ({
          key: `worked:${id}`,
          title: th.skills[id],
          spec: revealScene(generate({ skill: id, difficulty: 1, seed })),
        })),
      },
    ];
  }, [turn]);

  const entries = sections.flatMap((section) => section.entries);
  const at = entries.findIndex(({ key }) => key === open);
  const playing = at >= 0 ? entries[at] : null;

  const finished = () => {
    if (!playing) return;
    setSeen((before) => new Set(before).add(playing.key));
    // Skipping goes back to the list, and watching to the end goes on to the next clip.
    setOpen(skipped.current ? null : (entries[at + 1]?.key ?? null));
    skipped.current = false;
  };

  return (
    <main className="board min-h-dvh w-full px-4 pt-6 pb-10">
      <div className="mx-auto flex w-full max-w-lg flex-col gap-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-semibold">{th.clip.preview.title}</h1>
          <button
            type="button"
            onClick={() => setTurn((value) => value + 1)}
            className="min-h-11 shrink-0 rounded-lg px-3 text-sm text-brand underline underline-offset-4"
          >
            {th.clip.preview.again}
          </button>
        </div>
        <section className="flex flex-col gap-2">
          <h2 className="font-hand text-lg text-cta">{th.clip.preview.sounds}</h2>
          <div className="grid grid-cols-2 gap-2">
            {SOUNDS.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => sfx.play(name)}
                className="min-h-11 rounded-lg border border-line px-3 py-2 text-left"
              >
                {th.clip.preview.soundNames[name]}
              </button>
            ))}
          </div>
        </section>
        {sections.map((section) => (
          <section key={section.title} className="flex flex-col gap-1">
            <h2 className="font-hand text-lg text-cta">{section.title}</h2>
            <ul className="flex flex-col">
              {section.entries.map((entry) => {
                const detail = (entry.spec.captions as { compare?: string }).compare;
                return (
                  <li key={entry.key}>
                    <button
                      type="button"
                      onClick={() => setOpen(entry.key)}
                      className="flex min-h-11 w-full items-center justify-between gap-3 border-b border-line py-2 text-left"
                    >
                      <span className="min-w-0">
                        <span className="block">{entry.title}</span>
                        {detail && (
                          <span className="block truncate text-sm text-muted">
                            {detail.replace(/\n/g, ' ')}
                          </span>
                        )}
                      </span>
                      <span aria-hidden className="shrink-0 text-good">
                        {seen.has(entry.key) ? '✓' : ''}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      {playing && (
        <ScenePlayer
          key={playing.key}
          modal
          spec={playing.spec}
          title={playing.title}
          doneLabel={th.clip.preview.next}
          onView={(view) => {
            skipped.current = view.skipped;
          }}
          onDone={finished}
        />
      )}
    </main>
  );
}
