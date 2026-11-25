import { BoltIcon } from '@/components/ui/Icons';
import { th } from '@/lib/content/th';
import { fillTokens } from '@/lib/core/tokens';

interface StatBadgesProps {
  xp: number;
  combo: number;
}

/** One right answer is not yet a run, so the combo shows from the second. */
const COMBO_FROM = 2;

// Each number keeps a fixed width, so going from 90 to 100 XP or growing a combo cannot push the header
// around. The flame belongs to the day streak on the other pages, so the combo is written "×3".
export function StatBadges({ xp, combo }: StatBadgesProps) {
  const showCombo = combo >= COMBO_FROM;
  return (
    <div className="flex shrink-0 items-center gap-2 font-matrix text-sm font-semibold tabular-nums">
      <span
        role="img"
        aria-label={fillTokens(th.common.xpLabel, { xp: String(xp) })}
        className="inline-flex items-center gap-0.5 text-xp"
      >
        <BoltIcon className="size-4" />
        <span key={xp} className="inline-block min-w-[4ch] motion-safe:animate-pop">
          {xp}
        </span>
      </span>
      <span
        role={showCombo ? 'img' : undefined}
        aria-label={
          showCombo ? fillTokens(th.common.comboLabel, { combo: String(combo) }) : undefined
        }
        aria-hidden={showCombo ? undefined : true}
        className={`inline-block min-w-[3.5ch] text-right text-flame ${showCombo ? '' : 'invisible'}`}
      >
        <span key={combo} className="inline-block motion-safe:animate-pop">
          ×{combo}
        </span>
      </span>
    </div>
  );
}
