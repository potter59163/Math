import type { Metadata } from 'next';
import { th } from '@/lib/content/th';
import { FramesPreview } from './FramesPreview';

export const metadata: Metadata = { title: th.clip.preview.title, robots: { index: false } };

// Every beat of a vector clip as a still frame with its caption, the way prefers-reduced-motion shows
// it, so a whole clip can be checked at a glance. Like /preview/clip, it reads and writes nothing.
export default async function FramesPage({ searchParams }: PageProps<'/preview/clip/frames'>) {
  const { k, seed } = await searchParams;
  return (
    <FramesPreview
      only={typeof k === 'string' ? k : undefined}
      seed={typeof seed === 'string' ? Number(seed) || 7 : 7}
    />
  );
}
