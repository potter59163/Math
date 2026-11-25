'use client';

import dynamic from 'next/dynamic';

export const LazyFormula = dynamic(() => import('./Formula'), {
  ssr: false,
  loading: () => <div aria-hidden="true" className="my-1 h-8 rounded bg-sunken" />,
});

/** Fetches KaTeX ahead of need, so a slow school connection does not delay the formula itself. */
export function preloadFormula(): void {
  void import('./Formula');
}

/** The same inside a line of text, such as a named vector with its arrow on a choice button. */
export const LazyInlineFormula = dynamic(() => import('./InlineFormula'), {
  ssr: false,
  loading: () => <span aria-hidden="true" className="inline-block h-6 w-8 rounded bg-sunken" />,
});
