import { BoltIcon, FlameIcon } from '@/components/ui/Icons';
import { th } from '@/lib/content/th';
import { fillTokens } from '@/lib/core/tokens';

interface StatBadgesProps {
  xp: number;
  combo: number;
}

// Each number keeps a fixed width, so going from 90 to 100 XP cannot push the header around.
export function StatBadges({ xp, combo }: StatBadgesProps) {
  return (
    <div className="flex shrink-0 items-center gap-1.5 font-matrix text-sm font-semibold tabular-nums">
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
        role="img"
        aria-label={fillTokens(th.common.comboLabel, { combo: String(combo) })}
        className={`inline-flex items-center gap-0.5 ${combo > 0 ? 'text-flame' : 'text-muted'}`}
      >
        <FlameIcon className="size-4" />
        <span key={combo} className="inline-block min-w-[2ch] motion-safe:animate-pop">
          {combo}
        </span>
      </span>
    </div>
  );
}
