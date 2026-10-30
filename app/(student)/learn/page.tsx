import type { Metadata } from 'next';
import { LearnMap } from '@/components/learn/LearnMap';
import { th } from '@/lib/content/th';

export const metadata: Metadata = { title: th.learn.title };

export default function LearnPage() {
  return <LearnMap />;
}
