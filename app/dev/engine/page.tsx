import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { EngineLab } from './EngineLab';

export const metadata: Metadata = { title: 'Engine playground', robots: { index: false } };

// Developer tool: shows answer keys, so it must not exist in production.
export default function DevEnginePage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <EngineLab />;
}
