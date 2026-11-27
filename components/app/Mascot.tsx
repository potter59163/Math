import type { ThemeId } from '@/lib/learner/types';

export type MascotMood = 'happy' | 'thinking' | 'cheer' | 'party' | 'oops' | 'comfort' | 'asleep';

interface MascotProps {
  mood?: MascotMood;
  /** Drawn without any motion: a mark too small to read it, or the app's logo. */
  still?: boolean;
  /** The stories the student chose their examples from: คิว puts on one small thing for it. */
  wear?: ThemeId;
  className?: string;
}

const INK = 'var(--on-cta)';

/** A part turns and stretches about the foot of its own box, not about the corner of the drawing. */
const ON_ITS_FEET = '[transform-box:fill-box] origin-bottom';

/** What the whole note does as a mood begins, once (or for as long as คิว is thinking). */
const ENTRANCE: Record<MascotMood, string> = {
  happy: '',
  thinking: 'motion-safe:animate-mascot-sway',
  cheer: 'motion-safe:animate-mascot-hop',
  party: 'motion-safe:animate-mascot-party',
  oops: 'motion-safe:animate-mascot-shake',
  comfort: 'motion-safe:animate-mascot-comfort',
  asleep: '',
};

const SMILE = 'M25 43q7 6 14 0';
const FROWN = 'M26 47q6-6 12 0';
const LAUGH = 'M24 41q8 11 16 0z';

function Line({ d, className }: { d: string; className?: string }) {
  return (
    <path
      d={d}
      fill={d === LAUGH ? INK : 'none'}
      stroke={INK}
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    />
  );
}

function Eyes({ mood, alive }: { mood: MascotMood; alive: boolean }) {
  if (mood === 'asleep') return <Line d="M21.5 33q3.5 2.6 7 0M35.5 33q3.5 2.6 7 0" />;
  if (mood === 'party') return <Line d="M21.5 34.5q3.5-4.5 7 0M35.5 34.5q3.5-4.5 7 0" />;
  const y = mood === 'thinking' ? 30 : 33;
  return (
    <g
      className={
        alive
          ? '[transform-box:fill-box] origin-center motion-safe:animate-mascot-blink'
          : undefined
      }
    >
      <circle cx="25" cy={y} r="3.5" fill={INK} />
      <circle cx="39" cy={y} r="3.5" fill={INK} />
    </g>
  );
}

function Mouth({ mood, alive }: { mood: MascotMood; alive: boolean }) {
  if (mood === 'cheer' || mood === 'party') return <Line d={LAUGH} />;
  if (mood === 'thinking') return <Line d="M27 45h10" />;
  if (mood === 'asleep') return <Line d="M29 46h6" />;
  if (mood === 'oops') return <Line d={FROWN} />;
  if (mood === 'comfort' && alive) {
    // A wrong answer: the frown of the moment gives way to a smile. Without motion only the smile shows.
    return (
      <>
        <Line d={FROWN} className="opacity-0 motion-safe:animate-mascot-frown" />
        <Line d={SMILE} className="motion-safe:animate-mascot-smile" />
      </>
    );
  }
  return <Line d={SMILE} />;
}

// What it wears is partly outside the note, over whatever page is behind it, light or dark. So these
// things are one pale paper colour in both themes, with the note's own ink line round them.
const CLOTH = '#fdfbf3';
const PAPER = { fill: CLOTH, stroke: INK, strokeWidth: 2.5, strokeLinejoin: 'round' } as const;
const PEN = { fill: 'none', stroke: INK, strokeLinecap: 'round' } as const;

/**
 * One small thing per interest, drawn over the note and moving with it: a shopping bag, a gamepad, a
 * runner's headband, headphones, a cook's hat. Each stays close to the note's own box (a hat is a
 * fifth of the note tall), because a hop already uses the room around it.
 */
function Wear({ theme }: { theme: ThemeId }) {
  switch (theme) {
    case 'shop':
      return (
        <g data-wear="shop">
          <path d="M52.5 49v-2.5a4.5 4.5 0 0 1 9 0V49" {...PEN} strokeWidth="2.5" />
          <rect x="47.5" y="49" width="19" height="16" rx="2.5" {...PAPER} />
        </g>
      );
    case 'game':
      return (
        <g data-wear="game">
          <rect x="44.5" y="50" width="24" height="14" rx="7" {...PAPER} />
          <path d="M51.5 54.5v5M49 57h5" {...PEN} strokeWidth="2" />
          <circle cx="60" cy="55" r="1.6" fill={INK} />
          <circle cx="63.5" cy="59" r="1.6" fill={INK} />
        </g>
      );
    case 'sport':
      return (
        <g data-wear="sport">
          <path
            d="M5 12l-6-3M5 14l-7 3"
            fill="none"
            stroke="var(--flame)"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
          <path
            d="M5 10h40v6H5z"
            fill="var(--flame)"
            stroke={INK}
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
        </g>
      );
    case 'music':
      return (
        <g data-wear="music">
          <path d="M3 30a29 29 0 0 1 58 0" {...PEN} strokeWidth="5.5" />
          <path d="M3 30a29 29 0 0 1 58 0" {...PEN} stroke={CLOTH} strokeWidth="2.2" />
          <rect x="-2" y="26" width="8" height="16" rx="3.5" {...PAPER} />
          <rect x="58" y="26" width="8" height="16" rx="3.5" {...PAPER} />
        </g>
      );
    case 'food':
      return (
        <g data-wear="food">
          <path d="M16 4V0a5 5 0 0 1 4-8a8 8 0 0 1 14 0a5 5 0 0 1 4 8V4z" {...PAPER} />
          <path d="M16 0h22" {...PEN} strokeWidth="2" />
        </g>
      );
  }
}

/**
 * คิว: a face inside a matrix's brackets, on a sticky note with its corner folded. It breathes and
 * blinks while it waits, and each mood begins with a move of its own: a hop for a right answer, a
 * bigger one for a run of them, a shake that settles into a smile for a wrong one. All of it is
 * transform and opacity inside the drawing's own box, so nothing around it moves, and none of it
 * runs for a student who asked for less motion. Decoration beside text that says the same thing, so
 * it is hidden from screen readers.
 */
export function Mascot({
  mood = 'happy',
  still = false,
  wear,
  className = 'size-14',
}: MascotProps) {
  const alive = !still;
  const breath =
    mood === 'asleep' ? 'motion-safe:animate-mascot-doze' : 'motion-safe:animate-mascot-breathe';
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className={`overflow-visible ${className}`}>
      {/* Sparks go off behind the note, so whatever it wears stays in front of them. */}
      {alive && mood === 'party' && (
        <g
          key="sparks"
          stroke="var(--flame)"
          strokeWidth="3"
          strokeLinecap="round"
          className="[transform-box:fill-box] origin-center motion-safe:animate-spark motion-reduce:hidden"
          style={{ animationDelay: '180ms' }}
        >
          <path d="M9-2l-5-6M32-5v-8M55-2l5-6" fill="none" />
        </g>
      )}
      {/* Keyed by the mood, so a new mood starts its own move from the beginning. */}
      <g key={mood} className={alive ? `${ON_ITS_FEET} ${ENTRANCE[mood]}`.trim() : undefined}>
        <g className={alive ? `${ON_ITS_FEET} ${breath}` : undefined}>
          <path
            d="M9 4h36l15 15v37a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4V8a4 4 0 0 1 4-4z"
            fill="var(--cta)"
            stroke={INK}
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          <path
            d="M45 4v11a4 4 0 0 0 4 4h11z"
            fill="var(--surface)"
            stroke={INK}
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          <path
            d="M19 20h-6v33h6M45 26v27h-6"
            fill="none"
            stroke={INK}
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Eyes mood={mood} alive={alive} />
          <Mouth mood={mood} alive={alive} />
          {alive && wear && <Wear theme={wear} />}
        </g>
      </g>
      {/* The two z's stay in the corner the fold leaves free and rise only a little: on the lessons
          page a rule runs just above the note. */}
      {mood === 'asleep' &&
        [
          { d: 'M52 1h5l-5 6h5', delay: '0s' },
          { d: 'M60-9h6l-6 7h6', delay: '1.4s' },
        ].map(({ d, delay }) => (
          <path
            key={d}
            d={d}
            fill="none"
            stroke="var(--muted)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={
              alive
                ? '[transform-box:fill-box] origin-center motion-safe:animate-mascot-zed'
                : undefined
            }
            style={alive ? { animationDelay: delay } : undefined}
          />
        ))}
    </svg>
  );
}
