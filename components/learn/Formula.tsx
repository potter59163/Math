'use client';

import katex from 'katex';
import 'katex/dist/katex.min.css';
import { useMemo } from 'react';

/** Renders LaTeX from the engine. Load it through LazyFormula so KaTeX stays out of the first page. */
export default function Formula({ latex }: { latex: string }) {
  const html = useMemo(() => katex.renderToString(latex, { throwOnError: false }), [latex]);
  return <div className="overflow-x-auto py-1" dangerouslySetInnerHTML={{ __html: html }} />;
}
