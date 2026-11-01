import type { Metadata } from 'next';
import { LinkButton } from '@/components/ui/Button';
import { th } from '@/lib/content/th';

export const metadata: Metadata = { title: th.privacy.title };

export default function PrivacyPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col gap-4 px-4 py-6">
      <h1 className="text-2xl font-bold">{th.privacy.title}</h1>
      {th.privacy.sections.map(({ title, body }) => (
        <section key={title} className="rounded-2xl border border-line bg-surface p-4">
          <h2 className="font-bold">{title}</h2>
          <p className="text-muted">{body}</p>
        </section>
      ))}
      <LinkButton href="/" variant="secondary" className="mt-auto">
        {th.common.back}
      </LinkButton>
    </main>
  );
}
