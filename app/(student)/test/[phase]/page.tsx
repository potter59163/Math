import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { TestScreen } from '@/components/app/TestScreen';
import { th } from '@/lib/content/th';

type Props = { params: Promise<{ phase: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { phase } = await params;
  return { title: phase === 'post' ? th.test.titles.post : th.test.titles.pre };
}

export default async function TestPage({ params }: Props) {
  const { phase } = await params;
  if (phase !== 'pre' && phase !== 'post') notFound();
  return <TestScreen phase={phase} />;
}
