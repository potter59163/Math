import Link from 'next/link';
import type { ComponentProps } from 'react';

type Variant = 'primary' | 'secondary' | 'quiet';
type Size = 'md' | 'lg';

const BASE =
  'inline-flex touch-manipulation items-center justify-center gap-2 rounded-xl px-4 text-center font-semibold select-none transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-50';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand text-on-brand hover:bg-brand-strong active:bg-brand-strong',
  secondary: 'border-2 border-line bg-surface text-ink hover:bg-sunken active:bg-sunken',
  quiet: 'text-muted hover:text-ink',
};

/** Both sizes clear the 44px touch target. */
const SIZES: Record<Size, string> = { md: 'min-h-11', lg: 'min-h-12' };

interface Look {
  variant?: Variant;
  size?: Size;
}

function buttonClass({ variant = 'primary', size = 'lg' }: Look, extra = ''): string {
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
