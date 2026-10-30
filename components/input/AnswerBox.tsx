import { th } from '@/lib/content/th';
import { fillTokens } from '@/lib/core/tokens';
import { boxText } from '@/lib/practice/draft';

/** How a box looks once the item is closed. */
export type ClosedTone = 'correct' | 'neutral' | 'slip';

interface AnswerBoxProps {
  text: string;
  label: string;
  active: boolean;
  /** Set once the item is closed: the box stops responding and shows the result. */
  closedTone?: ClosedTone;
  /** Width and height. The box never resizes, so typing cannot move the layout. */
  sizeClass: string;
  onSelect(): void;
}

function textSize(length: number): string {
  if (length <= 4) return 'text-xl';
  return length <= 6 ? 'text-base' : 'text-sm';
}

function surface(active: boolean, closedTone?: ClosedTone): string {
  if (closedTone === 'correct') return 'border-good bg-good-soft';
  if (closedTone === 'slip') return 'border-warn bg-warn-soft';
  if (closedTone === 'neutral') return 'border-line bg-sunken';
  return active ? 'border-brand bg-brand-soft' : 'border-line bg-surface';
}

export function AnswerBox({
  text,
  label,
  active,
  closedTone,
  sizeClass,
  onSelect,
}: AnswerBoxProps) {
  const shown = boxText(text);
  return (
    <button
      type="button"
      data-box=""
      data-active={active && !closedTone}
      disabled={closedTone !== undefined}
      aria-pressed={active && !closedTone}
      aria-label={shown ? fillTokens(th.session.box.filled, { label, value: shown }) : label}
      onClick={onSelect}
      onFocus={onSelect}
      className={`flex touch-manipulation items-center justify-center rounded-lg border-2 font-matrix font-medium tabular-nums transition-colors select-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand ${sizeClass} ${textSize(shown.length)} ${surface(active, closedTone)}`}
    >
      {shown}
      {active && !closedTone && (
        <span
          aria-hidden="true"
          className="ml-0.5 h-5 w-0.5 rounded-full bg-brand motion-safe:animate-caret"
        />
      )}
    </button>
  );
}
