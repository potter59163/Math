'use client';

import { useState } from 'react';
import { Mascot, type MascotMood } from '@/components/app/Mascot';
import { TutorBubble } from '@/components/app/TutorBubble';

/** Each mood, and the moment of the app it belongs to. */
const MOODS: readonly { mood: MascotMood; when: string }[] = [
  { mood: 'happy', when: 'waiting' },
  { mood: 'thinking', when: 'loading, or the tutor is still answering' },
  { mood: 'cheer', when: 'a right answer' },
  { mood: 'party', when: 'a run of right answers, a milestone, the end of a lesson' },
  { mood: 'comfort', when: 'a wrong answer' },
  { mood: 'oops', when: 'something failed' },
  { mood: 'asleep', when: 'the flame went out' },
];

/** Plays a mood from its beginning each time it is pressed. */
export function MascotLab() {
  const [mood, setMood] = useState<MascotMood>('happy');
  const [turn, setTurn] = useState(0);
  const when = MOODS.find((entry) => entry.mood === mood)?.when;
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col gap-6 px-5 py-8">
      <h1 className="text-xl font-semibold">Mascot</h1>
      <div className="flex h-44 flex-col items-center justify-center gap-3">
        <Mascot key={turn} mood={mood} className="size-28 -rotate-3" />
        <p className="text-sm text-muted">{when}</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {MOODS.map((entry) => (
          <button
            key={entry.mood}
            type="button"
            aria-pressed={entry.mood === mood}
            onClick={() => {
              setMood(entry.mood);
              setTurn((value) => value + 1);
            }}
            className={`min-h-11 rounded-lg border px-3 py-2 text-left ${
              entry.mood === mood ? 'border-cta text-cta' : 'border-line'
            }`}
          >
            {entry.mood}
          </button>
        ))}
      </div>
      <section className="flex flex-col gap-3">
        <h2 className="font-hand text-lg text-cta">As small as in the feedback card</h2>
        <div className="rounded-xl bg-good-soft p-3">
          <TutorBubble key={`right-${turn}`} message="right answer" thinking={false} mood="cheer" />
        </div>
        <div className="rounded-xl bg-warn-soft p-3">
          <TutorBubble
            key={`wrong-${turn}`}
            message="wrong answer"
            thinking={false}
            mood="comfort"
          />
        </div>
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="font-hand text-lg text-cta">Kept still</h2>
        <div className="flex flex-wrap items-center gap-4">
          {MOODS.map((entry) => (
            <Mascot key={entry.mood} still mood={entry.mood} className="size-9" />
          ))}
        </div>
      </section>
    </main>
  );
}
