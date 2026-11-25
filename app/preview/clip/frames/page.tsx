import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { th } from '@/lib/content/th';
import { enabledTopics } from '@/lib/topics';
import { FramesPreview } from './FramesPreview';

export const metadata: Metadata = { title: th.clip.preview.title, robots: { index: false } };

// Every beat of a vector clip as a still frame with its caption, the way prefers-reduced-motion shows
// it, so a whole clip can be checked at a glance. Like /preview/clip, it reads and writes nothing.
export default async function FramesPage({ searchParams }: PageProps<'/preview/clip/frames'>) {
  // Vector clips stay unseen, and this heavy page unserved, until vectors are switched on.
  if (!enabledTopics().includes('vector')) notFound();
  const { k, seed } = await searchParams;
  const asked = typeof seed === 'string' ? Number(seed) : NaN;
  return (
    <FramesPreview
      only={typeof k === 'string' ? k : undefined}
      seed={Number.isSafeInteger(asked) && asked > 0 ? asked : 7}
    />
  );
}
