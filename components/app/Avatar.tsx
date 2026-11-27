import { th } from '@/lib/content/th';
import { AVATARS, type AvatarId } from '@/lib/sync/types';

/** A symbol stands for every student on the board unless they chose to show a photo of their own. */
const AVATAR_LOOK: Record<AvatarId, { glyph: string; className: string }> = {
  bracket: { glyph: '[ ]', className: 'bg-brand-soft text-brand' },
  sigma: { glyph: 'Σ', className: 'bg-good-soft text-good' },
  pi: { glyph: 'π', className: 'bg-xp-soft text-xp' },
  delta: { glyph: 'Δ', className: 'bg-warn-soft text-warn' },
  theta: { glyph: 'θ', className: 'bg-sunken text-ink' },
  infinity: { glyph: '∞', className: 'bg-cta text-on-cta' },
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

/**
 * A student's own picture where they have one, for their own eyes (their profile and settings), and
 * their symbol otherwise. What others see on the leaderboard is drawn there, from what the board sends.
 */
export function ProfilePicture({
  avatar,
  photoAt,
  className = 'size-10 text-lg',
}: {
  avatar: AvatarId;
  photoAt?: string;
  className?: string;
}) {
  if (!photoAt) return <Avatar avatar={avatar} className={className} />;
  return (
    // The picture comes from a signed-in route that the image optimizer could not reach, so a plain img.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/api/photo?v=${encodeURIComponent(photoAt)}`}
      alt={th.settings.photo.alt}
      className={`inline-block shrink-0 rounded-full object-cover ${className}`}
    />
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
          className={`flex aspect-square min-h-11 items-center justify-center rounded-xl border-2 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
            avatar === value ? 'border-brand bg-brand-soft' : 'border-line bg-surface'
          }`}
        >
          <Avatar avatar={avatar} className="size-9 text-base" />
        </button>
      ))}
    </div>
  );
}
