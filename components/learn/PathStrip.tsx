import { Mascot } from '@/components/app/Mascot';
import { th } from '@/lib/content/th';
import type { PathKind } from '@/lib/director/types';

/** Steps the pre-test decided get a label, so a student sees where the test changed their path. */
const LABELS: Partial<Record<PathKind, { text: string; look: string }>> = {
  skip_clip: { text: th.session.strip.quick, look: 'bg-good-soft text-good' },
  pretest_probe: { text: th.session.strip.check, look: 'bg-warn-soft text-warn' },
};

/**
 * Why this item is the student's next one (SPEC §4), written by คิว in the notebook's margin. Its
 * height never changes and the line is held even while empty, so a new step moves nothing on screen.
 */
export function PathStrip({ note, kind }: { note: string; kind?: PathKind | null }) {
  const label = kind ? LABELS[kind] : undefined;
  return (
    <div className="h-8 shrink-0 px-4">
      <p
        role="status"
        className="mx-auto flex h-8 max-w-lg items-center gap-1.5 border-l-2 border-margin pl-2 text-sm text-muted"
      >
        {note && <Mascot className="size-4 shrink-0" />}
        {note && label && (
          <span
            className={`shrink-0 rounded-full px-1.5 text-xs leading-5 font-semibold ${label.look}`}
          >
            {label.text}
          </span>
        )}
        <span className="min-w-0 truncate font-hand leading-8">{note}</span>
      </p>
    </div>
  );
}
