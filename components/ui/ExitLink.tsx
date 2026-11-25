import Link from 'next/link';
import { CrossIcon } from './Icons';

/**
 * The way out of a full-screen flow (practice, a test): an outlined button with a cross in the red pen,
 * where a student looks for it, and never plain grey text that reads as a caption.
 */
export function ExitLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-11 shrink-0 touch-manipulation items-center gap-1 rounded-full border-2 border-warn/40 bg-surface px-3 text-sm font-semibold text-warn transition-colors hover:bg-warn-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
    >
      <CrossIcon className="size-4 shrink-0" />
      {label}
    </Link>
  );
}
