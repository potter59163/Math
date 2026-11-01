import type { PathKind, PathStep } from '@/lib/director/types';

/** About what fits 360px. Older steps fall off the left, so 60 steps never overflow. */
const VISIBLE_DOTS = 24;

const FIXING: readonly PathKind[] = ['probe', 'pretest_probe', 'remediate', 'worked', 'concept'];

function dotColour(kind: PathKind): string {
  if (FIXING.includes(kind)) return 'bg-warn';
  if (kind === 'review' || kind === 'back') return 'bg-xp';
  return kind === 'advance' || kind === 'skip_clip' ? 'bg-good' : 'bg-brand';
}

/**
 * The student's own path (SPEC §4). Its height never changes and the note's line is held even while
 * empty, so a new step moves nothing on the screen.
 */
export function PathStrip({ steps, note }: { steps: readonly PathStep[]; note: string }) {
  const firstShown = Math.max(steps.length - VISIBLE_DOTS, 0);
  return (
    <div className="h-11 shrink-0 border-b border-line bg-surface px-4">
      <div className="mx-auto flex h-full max-w-lg flex-col justify-center">
        <ol aria-hidden className="flex h-3 items-center gap-1 overflow-hidden">
          {steps.slice(firstShown).map(({ kind }, index) => (
            <li
              key={firstShown + index}
              className={`size-1.5 shrink-0 rounded-full motion-safe:animate-rise ${dotColour(kind)} ${
                firstShown + index === steps.length - 1 ? 'ring-2 ring-brand-soft' : 'opacity-60'
              }`}
            />
          ))}
        </ol>
        <p role="status" className="h-6 truncate text-sm leading-6 text-muted">
          {note}
        </p>
      </div>
    </div>
  );
}
