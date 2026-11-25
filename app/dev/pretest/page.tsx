import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PretestLab } from './PretestLab';

export const metadata: Metadata = { title: 'Test report playground', robots: { index: false } };

type Props = { searchParams: Promise<{ case?: string }> };

// Developer tool: fixed students, so it must not exist in production.
export default async function DevPretestPage({ searchParams }: Props) {
  if (process.env.NODE_ENV === 'production') notFound();
  const { case: name = 'typical' } = await searchParams;
  return <PretestLab name={name} />;
}
