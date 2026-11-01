export type MascotMood = 'happy' | 'thinking' | 'cheer' | 'oops';

interface MascotProps {
  mood?: MascotMood;
  className?: string;
}

const MOUTHS: Record<MascotMood, string> = {
  happy: 'M25 43q7 6 14 0',
  cheer: 'M24 41q8 11 16 0z',
  thinking: 'M27 45h10',
  oops: 'M26 47q6-6 12 0',
};

/**
 * คิว: a face inside a matrix's brackets, on a sticky note with its corner folded. Decoration beside
 * text that says the same thing, so it is hidden from screen readers.
 */
export function Mascot({ mood = 'happy', className = 'size-14' }: MascotProps) {
  const looksUp = mood === 'thinking';
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className={className}>
      <path
        d="M9 4h36l15 15v37a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4V8a4 4 0 0 1 4-4z"
        fill="var(--cta)"
        stroke="var(--on-cta)"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path
        d="M45 4v11a4 4 0 0 0 4 4h11z"
        fill="var(--surface)"
        stroke="var(--on-cta)"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path
        d="M19 20h-6v33h6M45 26v27h-6"
        fill="none"
        stroke="var(--on-cta)"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="25" cy={looksUp ? 30 : 33} r="3.5" fill="var(--on-cta)" />
      <circle cx="39" cy={looksUp ? 30 : 33} r="3.5" fill="var(--on-cta)" />
      <path
        d={MOUTHS[mood]}
        fill={mood === 'cheer' ? 'var(--on-cta)' : 'none'}
        stroke="var(--on-cta)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
