import { LinkButton } from '@/components/ui/Button';
import { MatrixView } from '@/components/ui/MatrixView';
import { CONFIG } from '@/lib/config';
import { th } from '@/lib/content/th';
import { matrix } from '@/lib/topics/matrix/ops';

// Decoration only. Every number a student works with comes from the generators.
const SAMPLE = matrix([
  [2, 1],
  [3, 4],
]);

export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 px-4 py-10">
      <div className="text-2xl">
        <MatrixView value={SAMPLE} />
      </div>
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">{CONFIG.appName}</h1>
        <p className="text-lg font-medium">{th.home.tagline}</p>
      </header>
      <p>{th.home.description}</p>
      <LinkButton href="/join">{th.home.start}</LinkButton>
    </main>
  );
}
