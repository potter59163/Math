import type { Metadata } from 'next';
import { LeaderboardScreen } from '@/components/app/LeaderboardScreen';
import { th } from '@/lib/content/th';

export const metadata: Metadata = { title: th.board.title };

export default function LeaderboardPage() {
  return <LeaderboardScreen />;
}
