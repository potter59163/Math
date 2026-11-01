import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { TestScreen } from '@/components/app/TestScreen';
import { th } from '@/lib/content/th';

export const metadata: Metadata = { title: th.test.titles.pre };

export default async function TestPage({ params }: { params: Promise<{ phase: string }> }) {
  const { phase } = await params;
  if (phase !== 'pre' && phase !== 'post') notFound();
  return <TestScreen phase={phase} />;
}
