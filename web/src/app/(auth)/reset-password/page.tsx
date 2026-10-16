import type { Metadata } from 'next';
import { Suspense } from 'react';

import { ResetPasswordScreen } from '@/features/auth';

export const metadata: Metadata = { title: 'Nouveau mot de passe', robots: { index: false } };

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordScreen />
    </Suspense>
  );
}
