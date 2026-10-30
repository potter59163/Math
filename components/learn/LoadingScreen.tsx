import { th } from '@/lib/content/th';

export function LoadingScreen() {
  return (
    <main role="status" className="flex min-h-dvh items-center justify-center text-muted">
      {th.common.loading}
    </main>
  );
}
