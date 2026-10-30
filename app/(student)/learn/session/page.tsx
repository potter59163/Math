import type { Metadata } from 'next';
import { SessionScreen } from '@/components/learn/SessionScreen';
import { th } from '@/lib/content/th';

export const metadata: Metadata = { title: th.learn.title };

export default function SessionPage() {
  return <SessionScreen />;
}
