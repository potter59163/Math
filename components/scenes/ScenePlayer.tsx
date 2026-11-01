'use client';

import { LazyMotion, domAnimation, useReducedMotion } from 'motion/react';
import {
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useReducer,
  useRef,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { Button } from '@/components/ui/Button';
import { ArrowRightIcon, ReplayIcon } from '@/components/ui/Icons';
import { th } from '@/lib/content/th';
import { fillTokens } from '@/lib/core/tokens';
import type { SceneSpec } from '@/lib/topics/matrix/scenes';
import type { AnyScene } from '@/lib/topics/matrix/scenes/types';
import { initialPlayer, playerReducer, viewOf, type SceneView } from './playerState';
import { SceneStage } from './SceneStage';
import { BeatClockContext } from './svg';

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
}

export function ScenePlayer({
  spec,
  title,
  modal = false,
  onView,
  onDone,
  forceStill,
}: ScenePlayerProps) {
  const scene = spec as AnyScene;
  const [state, dispatch] = useReducer(playerReducer, scene.beats.length, initialPlayer);
  const prefersStill = useReducedMotion() ?? false;
  const still = forceStill ?? prefersStill;

  const startedAt = useRef(0);
  const logged = useRef(false);
  useEffect(() => {
    startedAt.current = performance.now();
  }, []);

  const report = useEffectEvent(() => {
    if (logged.current) return;
    logged.current = true;
    onView(viewOf(state, Math.round(performance.now() - startedAt.current)));
  });
  const finish = useEffectEvent(() => {
    report();
    onDone();
  });

  useEffect(() => {
    if (state.finished) finish();
  }, [state.finished]);

  // A class period ends without warning. The view still counts, as far as it got.
  useEffect(() => {
    const leave = () => report();
    window.addEventListener('pagehide', leave);
    return () => window.removeEventListener('pagehide', leave);
  }, []);

  const next = useRef<HTMLButtonElement>(null);
  useEffect(() => next.current?.focus({ preventScroll: true }), []);

  const beat = scene.beats[state.beat];
  const isLast = state.beat === state.total - 1;
  const caption = scene.captions[beat];
  const ms = scene.beatMs[beat] ?? 2000;
  const hasCaptions = scene.template !== 'worked_solution';

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      dispatch({ type: 'next' });
    }
  };

  const body = (
    <LazyMotion features={domAnimation} strict>
      <div
        onKeyDown={onKeyDown}
        className="mx-auto flex h-full w-full max-w-lg flex-col short-landscape:max-w-none short-landscape:flex-row"
      >
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <header className="flex h-12 shrink-0 items-center gap-1 pr-1 pl-4">
            <h2 className="min-w-0 flex-1 truncate text-sm font-semibold">{title}</h2>
            <ProgressDots scene={scene} beat={state.beat} />
            <Button
              variant="quiet"
              size="md"
              className="shrink-0 text-sm"
              onClick={() => dispatch({ type: 'skip' })}
            >
              {th.scenes.player.skip}
            </Button>
          </header>

          {/* Tapping the picture moves on too (SCENES §2). Buttons below do the same for a keyboard. */}
          <div
            onClick={() => dispatch({ type: 'next' })}
            className="min-h-0 flex-1 cursor-pointer select-none px-4 py-1"
          >
            <BeatClockContext.Provider value={{ ms, still }}>
              {/* A replay starts over from a clean first frame instead of animating backwards. */}
              <SceneStage key={state.replays} spec={spec} beat={beat} />
            </BeatClockContext.Provider>
          </div>
        </div>

        <div className="flex shrink-0 flex-col justify-end gap-1 px-4 pt-1 pb-[max(0.75rem,env(safe-area-inset-bottom))] short-landscape:w-64 short-landscape:justify-center">
          {hasCaptions && (
            // Fits one line at 360px, and has room for a second if a fallback font runs wide.
            <div role="status" className="flex min-h-[3.4rem] items-center justify-center">
              <p
                data-caption
                key={beat}
                className="text-center font-medium motion-safe:animate-rise"
              >
                {caption}
              </p>
            </div>
          )}
          <div className="grid grid-cols-[auto_1fr] gap-2">
            <Button variant="secondary" size="lg" onClick={() => dispatch({ type: 'replay' })}>
              <ReplayIcon className="size-5" />
              <span className="text-sm">{th.scenes.player.replay}</span>
            </Button>
            <Button ref={next} onClick={() => dispatch({ type: 'next' })}>
              {isLast ? th.scenes.player.done[spec.purpose] : th.scenes.player.next}
              {!isLast && <ArrowRightIcon className="size-4" />}
            </Button>
          </div>
        </div>
      </div>
    </LazyMotion>
  );

  return modal ? (
    <SceneDialog title={title} onSkip={() => dispatch({ type: 'skip' })}>
      {body}
    </SceneDialog>
  ) : (
    body
  );
}

function ProgressDots({ scene, beat }: { scene: AnyScene; beat: number }) {
  const label = fillTokens(th.scenes.player.progress, {
    beat: String(beat + 1),
    total: String(scene.beats.length),
  });
  return (
    <span role="img" aria-label={label} className="flex shrink-0 items-center gap-1">
      {scene.beats.map((name, index) => (
        <span
          key={name}
          className={`size-1.5 rounded-full ${
            name === scene.flagged ? 'bg-warn' : index <= beat ? 'bg-brand' : 'bg-line'
          } ${index === beat ? 'scale-125' : ''}`}
        />
      ))}
    </span>
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
      className="m-0 h-dvh max-h-none w-full max-w-none bg-canvas p-0 text-ink backdrop:bg-canvas open:block"
    >
      {children}
    </dialog>
  );
}
