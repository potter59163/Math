import type { Metadata } from 'next';
import { SummaryScreen } from '@/components/learn/SummaryScreen';
import { th } from '@/lib/content/th';

export const metadata: Metadata = { title: th.summary.title };

export default function SummaryPage() {
  return <SummaryScreen />;
}
