import { th } from '@/lib/content/th';
import { AVATARS, type AvatarId } from '@/lib/sync/types';

/** Symbols rather than photos, so no student's face ever appears next to their rank. */
const AVATAR_LOOK: Record<AvatarId, { glyph: string; className: string }> = {
  bracket: { glyph: '[ ]', className: 'bg-brand-soft text-brand' },
  sigma: { glyph: 'Σ', className: 'bg-good-soft text-good' },
  pi: { glyph: 'π', className: 'bg-xp-soft text-xp' },
  delta: { glyph: 'Δ', className: 'bg-warn-soft text-warn' },
  theta: { glyph: 'θ', className: 'bg-sunken text-ink' },
  infinity: { glyph: '∞', className: 'bg-brand text-on-brand' },
};

interface AvatarProps {
  avatar: AvatarId;
  className?: string;
}

export function Avatar({ avatar, className = 'size-10 text-lg' }: AvatarProps) {
  const look = AVATAR_LOOK[avatar] ?? AVATAR_LOOK.bracket;
  return (
    <span
      role="img"
      aria-label={th.avatars[avatar] ?? th.avatars.bracket}
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-matrix font-bold ${look.className} ${className}`}
    >
      {look.glyph}
    </span>
  );
}

interface AvatarPickerProps {
  value: AvatarId;
  label: string;
  onPick(avatar: AvatarId): void;
}

export function AvatarPicker({ value, label, onPick }: AvatarPickerProps) {
  return (
    <div role="radiogroup" aria-label={label} className="grid grid-cols-6 gap-2">
      {AVATARS.map((avatar) => (
        <button
          key={avatar}
          type="button"
          role="radio"
          aria-checked={avatar === value}
          aria-label={th.avatars[avatar]}
          onClick={() => onPick(avatar)}
          className={`flex aspect-square min-h-11 items-center justify-center rounded-2xl border-2 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
            avatar === value ? 'border-brand bg-brand-soft' : 'border-line bg-surface'
          }`}
        >
          <Avatar avatar={avatar} className="size-9 text-base" />
        </button>
      ))}
    </div>
  );
}
