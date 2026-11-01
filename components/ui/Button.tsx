import Link from 'next/link';
import type { ComponentProps } from 'react';

type Variant = 'primary' | 'secondary' | 'selected' | 'quiet';
type Size = 'compact' | 'md' | 'lg';

const BASE =
  'inline-flex touch-manipulation items-center justify-center gap-2 rounded-2xl text-center font-semibold select-none transition-[transform,box-shadow,background-color] duration-75 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:opacity-60';

// The shadow is the button's thick lower edge, and pressing slides the face down over it. Only
// transform and shadow change, so a press never moves anything around it.
const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-brand text-on-brand shadow-[0_3px_0_var(--brand-edge)] hover:bg-brand-strong active:translate-y-[3px] active:shadow-none',
  secondary:
    'border-2 border-line bg-surface text-ink shadow-[0_2px_0_var(--line)] hover:bg-sunken active:translate-y-[2px] active:shadow-none',
  selected: 'border-2 border-brand bg-brand-soft text-ink',
  quiet: 'text-muted hover:text-ink',
};

/** All sizes clear the 44px touch target. `compact` fits three buttons across a 360px screen. */
const SIZES: Record<Size, string> = {
  compact: 'min-h-11 px-3',
  md: 'min-h-11 px-4',
  lg: 'min-h-12 px-4',
};

interface Look {
  variant?: Variant;
  size?: Size;
}

export function buttonClass({ variant = 'primary', size = 'lg' }: Look, extra = ''): string {
  return `${BASE} ${VARIANTS[variant]} ${SIZES[size]} ${extra}`;
}

export function Button({ variant, size, className, ...props }: ComponentProps<'button'> & Look) {
  return <button type="button" className={buttonClass({ variant, size }, className)} {...props} />;
}

export function LinkButton({
  variant,
  size,
  className,
  ...props
}: ComponentProps<typeof Link> & Look) {
  return <Link className={buttonClass({ variant, size }, className)} {...props} />;
}
