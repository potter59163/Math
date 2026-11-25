'use client';

import katex from 'katex';
import 'katex/dist/katex.min.css';
import { useMemo } from 'react';

/** LaTeX from the engine, inside a line of text. Load it through LazyInlineFormula. */
export default function InlineFormula({ latex }: { latex: string }) {
  const html = useMemo(() => katex.renderToString(latex, { throwOnError: false }), [latex]);
  return <span className="inline-block align-middle" dangerouslySetInnerHTML={{ __html: html }} />;
}
