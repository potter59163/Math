import type { Metadata } from 'next';
import { Suspense } from 'react';
import { WelcomeFlow } from '@/components/app/WelcomeFlow';
import { CONFIG } from '@/lib/config';

export const metadata: Metadata = { title: CONFIG.appName };

export default function WelcomePage() {
  return (
    <Suspense>
      <WelcomeFlow />
    </Suspense>
  );
}
