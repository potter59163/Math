import type { Metadata } from 'next';
import { SettingsScreen } from '@/components/app/SettingsScreen';
import { th } from '@/lib/content/th';

export const metadata: Metadata = { title: th.settings.title };

export default function SettingsPage() {
  return <SettingsScreen />;
}
