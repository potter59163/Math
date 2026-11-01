import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SceneLab, type LabQuery } from './SceneLab';

export const metadata: Metadata = { title: 'Scene gallery', robots: { index: false } };

// Developer tool: plays answers and misconceptions on demand, so it must not exist in production.
export default async function DevScenesPage({ searchParams }: { searchParams: Promise<LabQuery> }) {
  if (process.env.NODE_ENV === 'production') notFound();
  return <SceneLab query={await searchParams} />;
}
