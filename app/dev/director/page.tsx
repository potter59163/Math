import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { DirectorLab } from './DirectorLab';

export const metadata: Metadata = { title: 'Director playground', robots: { index: false } };

// Developer tool: shows answer keys and how the rules decide, so it must not exist in production.
export default function DevDirectorPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <DirectorLab />;
}
