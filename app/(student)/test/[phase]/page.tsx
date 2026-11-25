import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { TestScreen } from '@/components/app/TestScreen';
import { th } from '@/lib/content/th';
import { ASSESSED_TOPIC, isTestedTopic } from '@/lib/sync/assessment';

type Props = {
  params: Promise<{ phase: string }>;
  /** `?topic=vector` for the vector test; none is the matrix test, the research's. */
  searchParams: Promise<{ topic?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { phase } = await params;
  return { title: phase === 'post' ? th.test.titles.post : th.test.titles.pre };
}

export default async function TestPage({ params, searchParams }: Props) {
  const { phase } = await params;
  const { topic = ASSESSED_TOPIC } = await searchParams;
  if (phase !== 'pre' && phase !== 'post') notFound();
  if (!isTestedTopic(topic)) notFound();
  return <TestScreen phase={phase} topic={topic} />;
}
