import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { th } from '@/lib/content/th';
import { fillTokens } from '@/lib/core/tokens';
import type { MatrixItem } from '@/lib/topics/matrix/types';
import { workedSteps } from '@/lib/topics/matrix/worked';
import { LazyFormula } from './LazyFormula';

interface WorkedSolutionSheetProps {
  item: MatrixItem;
  onClose(): void;
}

/** The solution a wrong answer can open (SPEC §4). The worked_solution scene takes over in Phase 3. */
export function WorkedSolutionSheet({ item, onClose }: WorkedSolutionSheetProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => dialog.current?.showModal(), []);

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      aria-labelledby="worked-title"
      className="m-auto mb-0 max-h-[85dvh] w-full max-w-lg flex-col rounded-t-2xl bg-surface p-0 text-ink backdrop:bg-black/50 open:flex"
    >
      <header className="flex items-center justify-between gap-2 border-b border-line py-1 pr-2 pl-4">
        <h2 id="worked-title" className="text-lg font-bold">
          {th.session.workedTitle}
        </h2>
        <Button variant="quiet" size="md" onClick={() => dialog.current?.close()}>
          {th.session.close}
        </Button>
      </header>
      {/* Focusable so a keyboard alone can scroll it. */}
      <ol
        tabIndex={0}
        aria-labelledby="worked-title"
        className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand"
      >
        {workedSteps(item).map((step, index) => (
          <li key={index} className="flex min-w-0 flex-col">
            <p className="font-medium">{fillTokens(th.worked[step.labelKey], step.params)}</p>
            <LazyFormula latex={step.latex} />
          </li>
        ))}
      </ol>
    </dialog>
  );
}
