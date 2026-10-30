import { th } from '@/lib/content/th';
import type { MatrixChoiceOption } from '@/lib/topics/matrix/types';

interface ChoiceButtonsProps {
  options: MatrixChoiceOption[];
  selected: string | null;
  onPick(id: string): void;
}

/** Big buttons that fill their slot: one column for two options, two columns for more (SPEC §5). */
export function ChoiceButtons({ options, selected, onPick }: ChoiceButtonsProps) {
  return (
    <div
      className={`grid min-h-0 flex-1 auto-rows-fr gap-2 ${options.length > 2 ? 'grid-cols-2' : ''}`}
    >
      {options.map(({ id, labelKey }) => {
        const isSelected = selected === id;
        return (
          <button
            key={id}
            type="button"
            aria-pressed={isSelected}
            onClick={() => onPick(id)}
            className={`touch-manipulation rounded-xl border-2 px-3 text-lg font-semibold transition-colors select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
              isSelected ? 'border-brand bg-brand-soft text-ink' : 'border-line bg-surface text-ink'
            }`}
          >
            {th.choices[labelKey]}
          </button>
        );
      })}
    </div>
  );
}
