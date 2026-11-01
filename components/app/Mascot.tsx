export type MascotMood = 'happy' | 'thinking' | 'cheer' | 'oops';

interface MascotProps {
  mood?: MascotMood;
  className?: string;
}

const MOUTHS: Record<MascotMood, string> = {
  happy: 'M24 40q8 7 16 0',
  cheer: 'M23 38q9 12 18 0z',
  thinking: 'M27 42h10',
  oops: 'M26 44q6-6 12 0',
};

/**
 * คิว: a face inside a matrix's brackets. Decoration beside text that says the same thing, so it is
 * hidden from screen readers.
 */
export function Mascot({ mood = 'happy', className = 'size-14' }: MascotProps) {
  const looksUp = mood === 'thinking';
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className={className}>
      <rect x="2" y="2" width="60" height="60" rx="18" fill="var(--brand)" />
      <path
        d="M17 13h-6v38h6M47 13h6v38h-6"
        fill="none"
        stroke="var(--on-brand)"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="24" cy={looksUp ? 25 : 28} r="4.5" fill="var(--on-brand)" />
      <circle cx="40" cy={looksUp ? 25 : 28} r="4.5" fill="var(--on-brand)" />
      <path
        d={MOUTHS[mood]}
        fill={mood === 'cheer' ? 'var(--on-brand)' : 'none'}
        stroke="var(--on-brand)"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
