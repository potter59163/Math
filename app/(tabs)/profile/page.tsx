import type { Metadata } from 'next';
import { ProfileScreen } from '@/components/app/ProfileScreen';
import { th } from '@/lib/content/th';

export const metadata: Metadata = { title: th.profile.title };

export default function ProfilePage() {
  return <ProfileScreen />;
}
