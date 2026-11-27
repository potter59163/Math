import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { MascotLab } from './MascotLab';

export const metadata: Metadata = { title: 'Mascot', robots: { index: false } };

// Developer tool: every mood of คิว and the move it starts with, so it must not exist in production.
export default function DevMascotPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <MascotLab />;
}
