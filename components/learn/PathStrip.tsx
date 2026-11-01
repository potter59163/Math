/**
 * Why this item is the student's next one (SPEC §4), as a note in the margin. Its height never changes
 * and the line is held even while empty, so a new step moves nothing on the screen.
 */
export function PathStrip({ note }: { note: string }) {
  return (
    <div className="h-8 shrink-0 px-4">
      <p
        role="status"
        className="mx-auto h-8 max-w-lg truncate font-hand text-sm leading-8 text-muted"
      >
        {note}
      </p>
    </div>
  );
}
