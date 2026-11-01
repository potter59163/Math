'use client';

import {
  LazyMotion,
  MotionConfig,
  domAnimation,
  useAnimationFrame,
  useMotionValue,
  type MotionValue,
} from 'motion/react';
import * as m from 'motion/react-m';
import {
  Fragment,
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { BeatClockContext } from '@/components/scenes/svg';
import { Button } from '@/components/ui/Button';
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  PauseIcon,
  PlayIcon,
  ReplayIcon,
  SpeakerIcon,
  SpeakerOffIcon,
} from '@/components/ui/Icons';
import { deviceSettings } from '@/lib/client/settings';
import { th } from '@/lib/content/th';
import { fillTokens } from '@/lib/core/tokens';
import { clipReducer, initialClip } from './clipState';
import { clipVoice } from './voice';

const DEFAULT_BEAT_MS = 3000;
/** The breath after a line, before the clip moves on. */
const VOICE_TAIL_MS = 450;
/** How long a beat waits for a line that started late on a slow network, before moving on anyway. */
const VOICE_HOLD_MS = 1500;
/** Tapping the outer part of the picture steps back or on, and the middle pauses, as in a story. */
const SIDE_ZONE = 0.3;

const CAPTION_PART = /\[([rcw]):([^\]]*)\]/g;
const TONES: Record<string, string> = { r: 'text-cta', c: 'text-brand', w: 'text-warn' };

const STILL_QUERY = '(prefers-reduced-motion: reduce)';

function subscribeToStill(onChange: () => void) {
  const query = window.matchMedia(STILL_QUERY);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

/** Words marked [r:…], [c:…] or [w:…] wear the colour of the row, the column or the mistake on screen. */
function Caption({ text }: { text: string }) {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(CAPTION_PART)) {
    parts.push(text.slice(last, match.index));
    parts.push(
      <span key={match.index} className={`font-semibold ${TONES[match[1]]}`}>
        {match[2]}
      </span>,
    );
    last = match.index + match[0].length;
  }
  parts.push(text.slice(last));
  return (
    <p className="text-center font-hand text-lg leading-snug whitespace-pre-line motion-safe:animate-rise [@media(min-height:700px)]:text-xl">
      {parts.map((part, index) => (
        <Fragment key={index}>{part}</Fragment>
      ))}
    </p>
  );
}

function Segment({ state, progress }: { state: number; progress: MotionValue<number> }) {
  return (
    <span className="h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-line">
      <m.span
        className="block h-full origin-left bg-cta"
        style={{ scaleX: state === 0 ? progress : state < 0 ? 1 : 0 }}
      />
    </span>
  );
}

export interface ClipVoiceLine {
  src: string;
  ms: number;
}

export interface ClipPlayerProps<Beat extends string> {
  title: string;
  beats: readonly Beat[];
  beatMs: Partial<Record<Beat, number>>;
  /** These wait for the student to do something, and the clock stops. */
  waits: readonly Beat[];
  /** The stage's width over its height, so that the caption can sit right under the picture. */
  aspect: number;
  /** A recorded line for each beat. A beat lasts at least as long as its line. */
  voice?: Partial<Record<Beat, ClipVoiceLine>>;
  /** Nothing has been tapped on this page yet, and a phone will not play sound before a tap. */
  waitForTap?: boolean;
  caption(beat: Beat): string;
  stage(beat: Beat, advance: () => void): ReactNode;
  doneLabel: string;
  onDone(): void;
  onSkip(): void;
}

/**
 * Plays by itself like a video, and stops only to ask something. A student who wants to read longer can
 * pause, and with reduced motion nothing moves on its own at all.
 */
export function ClipPlayer<Beat extends string>({
  title,
  beats,
  beatMs,
  waits,
  aspect,
  voice,
  waitForTap = false,
  caption,
  stage,
  doneLabel,
  onDone,
  onSkip,
}: ClipPlayerProps<Beat>) {
  const [state, dispatch] = useReducer(clipReducer, beats.length, initialClip);
  const [started, setStarted] = useState(!waitForTap);
  const [soundOn, setSoundOn] = useState(true);
  // Not motion's useReducedMotion, which reads the device while hydrating and so disagrees with the server.
  const prefersStill = useSyncExternalStore(
    subscribeToStill,
    () => window.matchMedia(STILL_QUERY).matches,
    () => false,
  );
  const settings = useSyncExternalStore(
    deviceSettings.subscribe,
    deviceSettings.get,
    deviceSettings.getServer,
  );
  const still = prefersStill || settings.reduceMotion;

  const beat = beats[state.index];
  const line = voice?.[beat];
  const ms = Math.max(beatMs[beat] ?? DEFAULT_BEAT_MS, (line?.ms ?? 0) + VOICE_TAIL_MS);
  const isLast = state.index === beats.length - 1;
  const waiting = waits.includes(beat);

  const progress = useMotionValue(0);
  const held = useRef(0);
  useEffect(() => {
    held.current = 0;
    progress.set(waiting || isLast || still ? 1 : 0);
  }, [progress, state.index, state.runs, waiting, isLast, still]);

  const say = useCallback((src: string) => {
    clipVoice.play(src).catch((error: Error) => {
      // Another line cutting in is ordinary. Anything else means this device will not play it now.
      if (error.name !== 'AbortError') setSoundOn(false);
    });
  }, []);

  useEffect(() => {
    if (voice) clipVoice.warm((Object.values(voice) as ClipVoiceLine[]).map(({ src }) => src));
  }, [voice]);

  const lineSrc = started ? line?.src : undefined;
  useEffect(() => {
    if (!lineSrc) return;
    say(lineSrc);
    return () => clipVoice.pause();
  }, [lineSrc, say, state.index, state.runs]);

  useEffect(() => {
    if (!started) return;
    if (state.paused) clipVoice.pause();
    else clipVoice.resume();
  }, [started, state.paused]);

  useEffect(() => {
    if (voice) clipVoice.setMuted(!soundOn);
  }, [voice, soundOn]);

  useEffect(() => {
    if (!started) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') dispatch({ type: 'next' });
      else if (event.key === 'ArrowLeft') dispatch({ type: 'back' });
      else if (
        event.key === ' ' &&
        !waiting &&
        !still &&
        !(event.target as Element).closest('button, [role=button]')
      ) {
        event.preventDefault();
        dispatch({ type: 'toggle' });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [started, waiting, still]);

  useAnimationFrame((_, delta) => {
    if (!started || still || state.paused || waiting || isLast) return;
    const reached = progress.get() + delta / ms;
    if (reached < 1) {
      progress.set(reached);
      return;
    }
    held.current += delta;
    if (clipVoice.isSpeaking() && held.current < VOICE_HOLD_MS) {
      progress.set(1);
      return;
    }
    progress.set(0);
    dispatch({ type: 'next' });
  });

  const start = () => {
    // Here in the tap and not in an effect, because that is where an iPhone allows sound.
    if (line) say(line.src);
    setStarted(true);
  };

  const toggleSound = () => {
    const on = !soundOn;
    setSoundOn(on);
    clipVoice.setMuted(!on);
    // A line the device refused, or one that ended while muted, can be heard now that there is a tap.
    if (on && lineSrc && !state.paused && !clipVoice.isSpeaking()) say(lineSrc);
  };

  const onStageClick = (event: MouseEvent<HTMLDivElement>) => {
    if (!started) {
      start();
      return;
    }
    if (waiting) return;
    const box = event.currentTarget.getBoundingClientRect();
    const at = (event.clientX - box.left) / box.width;
    if (at < SIDE_ZONE) dispatch({ type: 'back' });
    else if (at > 1 - SIDE_ZONE) dispatch({ type: 'next' });
    else if (!still && !isLast) dispatch({ type: 'toggle' });
  };

  const showPaused = state.paused && !waiting && !isLast;
  const progressLabel = fillTokens(th.clip.progress, {
    beat: String(state.index + 1),
    total: String(beats.length),
  });

  return (
    <MotionConfig reducedMotion={still ? 'always' : 'user'}>
      <LazyMotion features={domAnimation} strict>
        <div className="mx-auto flex h-full w-full max-w-lg flex-col">
          <div role="img" aria-label={progressLabel} className="flex shrink-0 gap-1 px-4 pt-3">
            {beats.map((name, index) => (
              <Segment key={name} state={index - state.index} progress={progress} />
            ))}
          </div>

          <header className="flex h-11 shrink-0 items-center pr-1 pl-4">
            <h1 className="min-w-0 flex-1 truncate text-sm font-semibold">{title}</h1>
            {voice && (
              <Button
                variant="quiet"
                size="md"
                className="shrink-0"
                aria-label={soundOn ? th.clip.soundOff : th.clip.soundOn}
                onClick={toggleSound}
              >
                {soundOn ? (
                  <SpeakerIcon className="size-5" />
                ) : (
                  <SpeakerOffIcon className="size-5" />
                )}
              </Button>
            )}
            <Button variant="quiet" size="md" className="shrink-0 text-sm" onClick={onSkip}>
              {th.clip.skip}
            </Button>
          </header>

          <div
            onClick={onStageClick}
            style={{ aspectRatio: aspect }}
            className="relative mx-2.5 min-h-0 shrink cursor-pointer select-none"
          >
            {started ? (
              <BeatClockContext.Provider value={{ ms, still }}>
                <Fragment key={state.runs}>
                  {stage(beat, () => dispatch({ type: 'next' }))}
                </Fragment>
              </BeatClockContext.Provider>
            ) : (
              <span className="absolute inset-0 grid place-items-center">
                <Button
                  aria-label={th.clip.start}
                  className="size-20 rounded-full!"
                  onClick={(event) => {
                    event.stopPropagation();
                    start();
                  }}
                >
                  <PlayIcon className="size-9 shrink-0" />
                </Button>
              </span>
            )}
            {showPaused && (
              <span className="pointer-events-none absolute inset-0 grid place-items-center">
                <span className="grid size-16 place-items-center rounded-full bg-sunken/80 text-ink">
                  <PlayIcon className="size-7" />
                </span>
              </span>
            )}
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-1 px-4 pt-1 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <div role="status" className="flex min-h-[3.6rem] shrink-0 items-center justify-center">
              {started && <Caption key={`${beat}${caption(beat)}`} text={caption(beat)} />}
            </div>

            {started && (
              <div className="mt-auto shrink-0">
                {isLast ? (
                  <div className="grid grid-cols-[auto_1fr] gap-2">
                    <Button
                      variant="secondary"
                      size="lg"
                      onClick={() => dispatch({ type: 'replay' })}
                    >
                      <ReplayIcon className="size-5" />
                      <span className="text-sm">{th.clip.again}</span>
                    </Button>
                    <Button onClick={onDone}>{doneLabel}</Button>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2">
                    <Button
                      variant="quiet"
                      size="md"
                      aria-label={th.clip.back}
                      onClick={() => dispatch({ type: 'back' })}
                    >
                      <ArrowLeftIcon className="size-5" />
                    </Button>
                    {!still && !waiting && (
                      <Button
                        variant="quiet"
                        size="md"
                        aria-label={state.paused ? th.clip.play : th.clip.pause}
                        onClick={() => dispatch({ type: 'toggle' })}
                      >
                        {state.paused ? (
                          <PlayIcon className="size-5" />
                        ) : (
                          <PauseIcon className="size-5" />
                        )}
                      </Button>
                    )}
                    <Button
                      variant="quiet"
                      size="md"
                      aria-label={th.clip.forward}
                      onClick={() => dispatch({ type: 'next' })}
                    >
                      <ArrowRightIcon className="size-5" />
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </LazyMotion>
    </MotionConfig>
  );
}
