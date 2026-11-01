import { MatrixView } from '@/components/ui/MatrixView';
import { th } from '@/lib/content/th';
import { matrix } from '@/lib/topics/matrix/ops';
import { Mascot } from './Mascot';

// Decoration only. Every number a student works with comes from the generators.
const A = matrix([
  [1, 2],
  [3, 4],
]);
const B = matrix([
  [5, 6],
  [7, 8],
]);
/** The mistake the app is best at catching: multiplying cell by cell. */
const CELL_BY_CELL = A.map((row, i) => row.map((cell, j) => cell.mul(B[i][j])));

/** A page of a student's notebook: their answer in blue, and คิว's correction in red pen. */
export function NotebookDemo({ className = '' }: { className?: string }) {
  return (
    <figure role="img" aria-label={th.home.demoLabel} className={`relative ${className}`}>
      <div className="relative -rotate-1 rounded-sm border border-line bg-surface px-4 pt-7 pb-5 shadow-[0_18px_30px_-20px_rgb(23_33_46/0.55)]">
        <span
          aria-hidden
          className="absolute -top-2.5 left-1/2 h-5 w-20 -translate-x-1/2 rotate-2 bg-marker opacity-80"
        />
        <div aria-hidden className="flex flex-col gap-3">
          <div className="flex items-center justify-center gap-1.5 text-lg">
            <MatrixView value={A} />
            <MatrixView value={B} />
            <span className="px-0.5 font-matrix text-muted">=</span>
            <span className="relative">
              <MatrixView value={CELL_BY_CELL} cellClassName="font-hand text-brand" />
              <svg
                viewBox="0 0 100 60"
                preserveAspectRatio="none"
                className="absolute -inset-x-2.5 -inset-y-2 h-[calc(100%+1rem)] w-[calc(100%+1.25rem)] overflow-visible"
              >
                <path
                  d="M54 3C28 1 5 11 3 30c-2 19 23 28 49 27 26-1 46-12 45-29C96 10 69 0 38 6"
                  fill="none"
                  stroke="var(--warn)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
            </span>
          </div>
          <p className="pr-14 font-hand leading-snug text-warn">
            {th.home.demoNote.map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
          </p>
        </div>
      </div>
      <Mascot className="absolute right-2 -bottom-3 size-14 rotate-6" />
    </figure>
  );
}
