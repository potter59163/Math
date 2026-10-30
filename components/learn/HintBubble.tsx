import { BulbIcon } from '@/components/ui/Icons';
import { th } from '@/lib/content/th';
import { fillTokens } from '@/lib/core/tokens';
import type { Hint } from '@/lib/practice/hints';
import { LazyFormula } from './LazyFormula';

/** One hint at a time: the latest replaces the last, so text never piles up (SPEC §1.1). */
export function HintBubble({ hint }: { hint: Hint }) {
  return (
    <div
      role="status"
      className="flex gap-2 rounded-xl bg-brand-soft p-3 text-sm motion-safe:animate-rise"
    >
      <BulbIcon className="size-5 shrink-0 text-brand" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">
          {fillTokens(th.session.hintTitle, { level: String(hint.level) })}
        </p>
        <p>{hint.text}</p>
        {hint.latex && <LazyFormula latex={hint.latex} />}
      </div>
    </div>
  );
}
