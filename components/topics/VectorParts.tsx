import { LazyFormula, LazyInlineFormula } from '@/components/learn/LazyFormula';
import { th } from '@/lib/content/th';
import type { Item } from '@/lib/core/types';
import { choiceLatex, givenLatex, promptParts } from '@/lib/topics/vector/display';
import { givenVectors } from '@/lib/topics/vector/format';
import type { VectorItem } from '@/lib/topics/vector/types';
import { VectorFigure } from './VectorFigure';

// What only a vector item draws: its givens in KaTeX, the figure of a geometry item, and the arrow
// over a named vector wherever one is written. Numbers all come from the engine.

export function VectorGivens({ item }: { item: Item }) {
  const { data } = item as VectorItem;
  const givens = givenVectors(data);
  const figure = 'figure' in data ? data.figure : undefined;
  if (givens.length === 0 && !figure) return null;
  return (
    <div className="flex flex-col gap-2">
      {figure && <VectorFigure figure={figure} />}
      {givens.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-lg">
          {givens.map((given) => (
            <LazyFormula key={given.label} latex={givenLatex(given)} />
          ))}
        </div>
      )}
    </div>
  );
}

export function VectorPrompt({ item }: { item: Item }) {
  return (
    <>
      {promptParts(item as VectorItem).map((part, index) =>
        'latex' in part ? (
          <LazyInlineFormula key={index} latex={part.latex} />
        ) : (
          <span key={index}>{part.text}</span>
        ),
      )}
    </>
  );
}

export function VectorChoiceLabel({ labelKey }: { labelKey: string }) {
  const latex = choiceLatex(labelKey);
  const text = th.vector.choices[labelKey as keyof typeof th.vector.choices];
  if (!latex) return text;
  return (
    <span role="img" aria-label={text}>
      <LazyInlineFormula latex={latex} />
    </span>
  );
}
