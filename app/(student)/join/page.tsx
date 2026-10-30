import type { Metadata } from 'next';
import { JoinForm } from '@/components/learn/JoinForm';
import { th } from '@/lib/content/th';

export const metadata: Metadata = { title: th.join.title };

export default function JoinPage() {
  return <JoinForm />;
}
