import { Suspense } from 'react';
import { WelcomeFlow } from '@/components/app/WelcomeFlow';

export default function WelcomePage() {
  return (
    <Suspense>
      <WelcomeFlow />
    </Suspense>
  );
}
