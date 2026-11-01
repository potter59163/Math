import type { Metadata } from 'next';
import { LinkButton } from '@/components/ui/Button';
import { th } from '@/lib/content/th';

export const metadata: Metadata = { title: th.privacy.title };

export default function PrivacyPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col gap-5 px-5 py-8">
      <h1 className="text-3xl font-semibold">
        <span className="marker">{th.privacy.title}</span>
      </h1>
      {th.privacy.sections.map(({ title, body }) => (
        <section key={title} className="flex flex-col gap-1">
          <h2 className="text-lg">{title}</h2>
          <p className="text-muted">{body}</p>
        </section>
      ))}
      <LinkButton href="/" variant="secondary" className="mt-auto">
        {th.common.back}
      </LinkButton>
    </main>
  );
}
