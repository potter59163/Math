import { CheckIcon, CrossIcon } from '@/components/ui/Icons';
import { th } from '@/lib/content/th';
import { Mascot } from './Mascot';

/**
 * A page of a student's notebook after คิว has been through it: their working in blue, and in red what
 * went wrong and why. Decoration only, from across upper-secondary maths and not from any one topic.
 * Every number in a lesson comes from the generators.
 */
export function NotebookDemo({ className = '' }: { className?: string }) {
  return (
    <figure role="img" aria-label={th.home.demoLabel} className={`relative ${className}`}>
      <div className="relative -rotate-1 rounded-sm border border-line bg-surface px-4 pt-7 pb-5 shadow-[0_18px_30px_-20px_rgb(23_33_46/0.55)]">
        <span
          aria-hidden
          className="absolute -top-2.5 left-1/2 h-5 w-20 -translate-x-1/2 rotate-2 bg-marker opacity-80"
        />
        <ul aria-hidden className="flex flex-col gap-2 font-hand text-lg whitespace-nowrap">
          <li className="flex items-center gap-2">
            <CheckIcon className="size-5 shrink-0 text-good" />
            <span className="text-brand">(x + 3)² = x² + 6x + 9</span>
          </li>
          <li className="flex items-center gap-2">
            <CheckIcon className="size-5 shrink-0 text-good" />
            <span className="text-brand">sin²x + cos²x = 1</span>
          </li>
          <li className="flex items-center gap-2">
            <CrossIcon className="size-5 shrink-0 text-warn" />
            <span className="text-brand">
              log(a + b) ={' '}
              <span className="relative ml-1.5 inline-block">
                log a + log b
                <svg
                  viewBox="0 0 100 60"
                  preserveAspectRatio="none"
                  className="absolute -inset-x-3 -inset-y-1.5 h-[calc(100%+0.75rem)] w-[calc(100%+1.5rem)] overflow-visible"
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
            </span>
          </li>
        </ul>
        <p aria-hidden className="mt-3 pr-14 pl-7 font-hand leading-snug text-warn">
          {th.home.demoNote.map((line) => (
            <span key={line} className="block">
              {line}
            </span>
          ))}
        </p>
      </div>
      <Mascot className="absolute right-2 -bottom-3 size-14 rotate-6" />
    </figure>
  );
}
