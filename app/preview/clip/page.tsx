import type { Metadata } from 'next';
import { th } from '@/lib/content/th';
import { ClipPreview } from './ClipPreview';

export const metadata: Metadata = { title: th.clip.preview.title, robots: { index: false } };

// A new kind of clip, for Potter to look at on a real phone before it reaches any student. It reads and
// writes nothing, and nothing in the app links here.
export default function ClipPreviewPage() {
  return <ClipPreview />;
}
