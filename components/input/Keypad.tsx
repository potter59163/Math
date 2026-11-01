import type { ReactNode } from 'react';
import { ArrowRightIcon, BackspaceIcon, CheckIcon } from '@/components/ui/Icons';
import { th } from '@/lib/content/th';
import type { KeypadKey } from '@/lib/practice/draft';

interface KeyDef {
  key: KeypadKey;
  label: ReactNode;
  ariaLabel?: string;
  /** Has no use when typing whole numbers, as in dimensions. */
  numberOnly?: boolean;
}

const digit = (key: KeypadKey): KeyDef => ({ key, label: key });

const { keys } = th.session;

/** Laid out like a phone keypad, with the send key added in the corner (SPEC §5). */
const ROWS: KeyDef[][] = [
  [
    digit('7'),
    digit('8'),
    digit('9'),
    { key: 'backspace', label: <BackspaceIcon />, ariaLabel: keys.backspace },
  ],
  [
    digit('4'),
    digit('5'),
    digit('6'),
    { key: '-', label: '−', ariaLabel: keys.minus, numberOnly: true },
  ],
  [
    digit('1'),
    digit('2'),
    digit('3'),
    { key: '/', label: '/', ariaLabel: keys.slash, numberOnly: true },
  ],
  [
    digit('0'),
    { key: '.', label: '.', ariaLabel: keys.point, numberOnly: true },
    { key: 'next', label: <ArrowRightIcon />, ariaLabel: keys.next },
  ],
];

const KEY =
  'flex h-12 min-w-0 touch-manipulation items-center justify-center rounded-xl text-xl font-medium select-none motion-safe:transition-transform motion-safe:active:scale-95';

interface KeypadProps {
  digitsOnly: boolean;
  sendReady: boolean;
  onKey(key: KeypadKey): void;
  onSend(): void;
}

// Keys stay out of the tab order and never take focus: a physical keyboard types directly, and Enter
// must keep meaning "send" rather than repeating the last key clicked.
const keepFocus = (event: { preventDefault(): void }) => event.preventDefault();

export function Keypad({ digitsOnly, sendReady, onKey, onSend }: KeypadProps) {
  return (
    <div className="grid grid-cols-4 gap-1.5 font-matrix">
      {ROWS.flat().map(({ key, label, ariaLabel, numberOnly }) => (
        <button
          key={key}
          type="button"
          tabIndex={-1}
          aria-label={ariaLabel}
          disabled={digitsOnly && numberOnly}
          onMouseDown={keepFocus}
          onClick={() => onKey(key)}
          className={`${KEY} border border-line bg-surface text-ink shadow-[0_2px_0_var(--line)] disabled:opacity-30`}
        >
          {label}
        </button>
      ))}
      <button
        type="button"
        tabIndex={-1}
        aria-label={th.session.send}
        aria-disabled={!sendReady}
        onMouseDown={keepFocus}
        onClick={onSend}
        className={`${KEY} gap-1 text-base font-semibold ${
          sendReady
            ? 'border-2 border-cta-line bg-cta text-on-cta shadow-[0_2px_0_var(--cta-line)]'
            : 'border border-line bg-surface text-muted'
        }`}
      >
        <CheckIcon className="size-4" />
        <span className="font-sans">{th.session.send}</span>
      </button>
    </div>
  );
}
