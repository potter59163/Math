import { componentsOf } from '@/components/topics';
import type { ChoiceOption } from '@/lib/core/types';
import { DEFAULT_TOPIC, packOf } from '@/lib/topics';

interface ChoiceButtonsProps {
  options: ChoiceOption[];
  /** The item's topic, which writes the labels. */
  topic?: string;
  selected: string | null;
  onPick(id: string): void;
}

/** Big buttons that fill their slot: one column for two options, two columns for more (SPEC §5). */
export function ChoiceButtons({
  options,
  topic = DEFAULT_TOPIC,
  selected,
  onPick,
}: ChoiceButtonsProps) {
  const { ChoiceLabel } = componentsOf(topic);
  const { copy } = packOf(topic);
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
              isSelected ? 'border-brand bg-brand-soft text-ink' : 'border-edge bg-surface text-ink'
            }`}
          >
            {ChoiceLabel ? <ChoiceLabel labelKey={labelKey} /> : copy.choiceLabel(labelKey)}
          </button>
        );
      })}
    </div>
  );
}
