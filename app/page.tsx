import { CONFIG } from '@/lib/config';
import { th } from '@/lib/content/th';

// Placeholder until MatrixView arrives in Phase 2: shows the tabular number font.
const SAMPLE_CELLS = ['−3/2', '10', '4', '−1/2'];

export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 px-4 py-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">{CONFIG.appName}</h1>
        <p className="text-lg font-medium">{th.home.tagline}</p>
      </header>
      <p>{th.home.description}</p>
      <figure className="flex flex-col gap-2">
        <div className="grid w-fit grid-cols-2 gap-x-6 border-x-2 border-current px-3 py-1 font-matrix text-xl tabular-nums">
          {SAMPLE_CELLS.map((cell) => (
            <span key={cell} className="text-right">
              {cell}
            </span>
          ))}
        </div>
        <figcaption className="text-sm text-neutral-600 dark:text-neutral-400">
          {th.home.numberSample}
        </figcaption>
      </figure>
      <p className="text-sm text-neutral-600 dark:text-neutral-400">{th.home.status}</p>
    </main>
  );
}
