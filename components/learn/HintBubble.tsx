import { BulbIcon } from '@/components/ui/Icons';
import { th } from '@/lib/content/th';
import { fillTokens } from '@/lib/core/tokens';
import type { Hint } from '@/lib/practice/hints';
import { LazyFormula } from './LazyFormula';

/**
 * A sticky note stuck beside the item. One hint at a time: the latest replaces the last, so text never
 * piles up (SPEC §1.1).
 */
export function HintBubble({ hint }: { hint: Hint }) {
  return (
    <div
      role="status"
      className="flex gap-2 rounded-sm bg-marker-soft p-3 text-sm shadow-[0_8px_16px_-12px_rgb(23_33_46/0.5)] motion-safe:animate-rise"
    >
      <BulbIcon className="size-5 shrink-0 text-xp" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">
          {fillTokens(th.session.hintTitle, { level: String(hint.level) })}
        </p>
        <p className="font-hand leading-relaxed">{hint.text}</p>
        {hint.latex && <LazyFormula latex={hint.latex} />}
      </div>
    </div>
  );
}
