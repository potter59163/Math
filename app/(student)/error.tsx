'use client';

import { Button } from '@/components/ui/Button';
import { th } from '@/lib/content/th';

// A crash mid-class must leave the student a way back. Progress is saved after every item.
export default function StudentError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-xl font-bold">{th.common.errorTitle}</h1>
      <p className="text-muted">{th.common.errorBody}</p>
      <Button onClick={retry} className="w-full">
        {th.common.retry}
      </Button>
    </main>
  );
}
