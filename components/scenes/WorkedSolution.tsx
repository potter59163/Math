import { useEffect, useRef } from 'react';
import { LazyFormula } from '@/components/learn/LazyFormula';
import type { SceneSpecOf, WorkedBeat } from '@/lib/topics/matrix/scenes/types';

interface Props {
  spec: SceneSpecOf<'worked_solution'>;
  beat: WorkedBeat;
}

/** SCENES §3.5. Steps open one at a time and stay on screen, each scrolled into view. */
export function WorkedSolution({ spec, beat }: Props) {
  const { steps } = spec.params;
  const beatIndex = spec.beats.indexOf(beat);
  const shown = steps.filter((step) => spec.beats.indexOf(step.beat) <= beatIndex);

  const newest = useRef<HTMLLIElement>(null);
  useEffect(() => {
    newest.current?.scrollIntoView({ block: 'nearest' });
  }, [beatIndex]);

  return (
    <div
      // Focusable so a keyboard alone can scroll a long solution.
      tabIndex={0}
      className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto p-1 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand"
    >
      <ol className="flex flex-col gap-3">
        {shown.map((step, index) => (
          <li
            key={index}
            ref={index === shown.length - 1 ? newest : undefined}
            className="flex min-w-0 flex-col motion-safe:animate-rise"
          >
            <p className="font-medium">{step.text}</p>
            <LazyFormula latex={step.latex} />
          </li>
        ))}
      </ol>
    </div>
  );
}
