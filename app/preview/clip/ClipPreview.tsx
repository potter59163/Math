'use client';

import { useMemo, useState } from 'react';
import { ReceiptClipPlayer } from '@/components/clip/ReceiptStage';
import { th } from '@/lib/content/th';
import type { ThemeId } from '@/lib/learner/types';
import { generate } from '@/lib/topics/matrix/generators';
import { receiptClip } from '@/lib/topics/matrix/scenes/receiptClip';

const THEMES: readonly ThemeId[] = ['game', 'shop', 'food', 'music', 'sport'];
const FIRST_SEED = 7;
const SEEDS_TO_TRY = 200;

/** A student caught multiplying cell by cell, with the answer that mistake really gives. */
function caughtStudent(start: number, theme: ThemeId) {
  for (let seed = start; seed < start + SEEDS_TO_TRY; seed += 1) {
    const item = generate({ skill: 'mult', difficulty: 1, seed, target: 'M09_MULT_ELEMENTWISE' });
    const wrong = item.diagnostics.find(({ id }) => id === 'M09_MULT_ELEMENTWISE');
    if (item.data.form !== 'mult' || wrong?.answer.kind !== 'matrix') continue;
    const clip = receiptClip({
      left: item.data.A,
      right: item.data.B,
      student: wrong.answer.value,
      theme,
    });
    if (clip) return clip;
  }
  throw new Error('caughtStudent: no seed worked');
}

export function ClipPreview() {
  const [turn, setTurn] = useState(0);
  const clip = useMemo(
    () => caughtStudent(FIRST_SEED + turn * 13, THEMES[turn % THEMES.length]),
    [turn],
  );
  const again = () => setTurn((value) => value + 1);
  return (
    <main className="board h-dvh w-full overflow-hidden">
      <ReceiptClipPlayer
        key={turn}
        clip={clip}
        doneLabel={th.clip.preview.next}
        onDone={again}
        onSkip={again}
      />
    </main>
  );
}
