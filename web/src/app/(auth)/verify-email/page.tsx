import type { Metadata } from 'next';
import { Suspense } from 'react';

import { VerifyEmailScreen } from '@/features/auth';

export const metadata: Metadata = { title: 'Confirmer mon adresse', robots: { index: false } };

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailScreen />
    </Suspense>
  );
}
