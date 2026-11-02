'use client';

import { useLayoutEffect, useMemo, useRef, type ReactNode } from 'react';
import { ClipPlayer, type ClipVoiceLine } from '@/components/clip/ClipPlayer';
import { STAGE_ASPECT } from '@/components/clip/kit';
import { clipVoice } from '@/components/clip/voice';
import { th } from '@/lib/content/th';
import type { SceneSpec } from '@/lib/topics/matrix/scenes';
import type { AnyScene } from '@/lib/topics/matrix/scenes/types';
import { recordedLine } from '@/lib/topics/matrix/scenes/voice';
import type { SceneView } from './playerState';
import { SceneStage } from './SceneStage';

export interface ScenePlayerProps {
  spec: SceneSpec;
  title: string;
  /** Goes over the page in a modal dialog. Without it the player fills its parent, for /dev/scenes. */
  modal?: boolean;
  /** Called once, when the scene ends or the page goes away mid-scene. */
  onView(view: SceneView): void;
  onDone(): void;
  /** Lets /dev/scenes preview a still frame without changing the operating system setting. */
  forceStill?: boolean;
  /** The last button, when what follows is not what this kind of scene usually leads to. */
  doneLabel?: string;
}

const NO_BEATS: readonly string[] = [];

/** The recorded line of each beat it has one for. A line not recorded yet is simply silent. */
function linesOf(scene: AnyScene): Partial<Record<string, ClipVoiceLine>> {
  const lines: Partial<Record<string, ClipVoiceLine>> = {};
  for (const beat of scene.beats) {
    const id = scene.voice[beat];
    const line = id && recordedLine(id);
    if (line) lines[beat] = line;
  }
  return lines;
}

export function ScenePlayer({
  spec,
  title,
  modal = false,
  onView,
  onDone,
  forceStill,
  doneLabel,
}: ScenePlayerProps) {
  const scene = spec as AnyScene;
  const voice = useMemo(() => linesOf(scene), [scene]);
  const skip = useRef<(() => void) | null>(null);

  const body = (
    <ClipPlayer
      title={title}
      beats={scene.beats}
      beatMs={scene.beatMs}
      waits={scene.waits ?? NO_BEATS}
      aspect={spec.template === 'worked_solution' ? undefined : STAGE_ASPECT}
      voice={voice}
      waitForTap={!clipVoice.isUnlocked()}
      caption={(beat) => scene.captions[beat]}
      hint={(beat) => {
        const hint = scene.hints?.[beat];
        return hint && { caption: hint.caption, src: recordedLine(hint.voice)?.src };
      }}
      stage={(beat) => <SceneStage spec={spec} beat={beat} />}
      doneLabel={doneLabel ?? th.scenes.player.done[spec.purpose]}
      forceStill={forceStill}
      onView={onView}
      onDone={onDone}
      skipRef={skip}
    />
  );

  return modal ? (
    <SceneDialog title={title} onSkip={() => skip.current?.()}>
      {body}
    </SceneDialog>
  ) : (
    <div className="board h-full w-full">{body}</div>
  );
}

function SceneDialog({
  title,
  onSkip,
  children,
}: {
  title: string;
  onSkip(): void;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  // Before paint, so the page behind never shows through for a frame. Closing hands focus back.
  useLayoutEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault();
        onSkip();
      }}
      className="board m-0 h-dvh max-h-none w-full max-w-none p-0 backdrop:bg-black open:block"
    >
      {children}
    </dialog>
  );
}
