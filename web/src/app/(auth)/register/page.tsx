import type { Metadata } from 'next';
import { Suspense } from 'react';

import { LoginScreen } from '@/features/auth';

export const metadata: Metadata = {
  title: 'Inscription — AfriDev Exchange',
  description: 'Créez votre compte sur AfriDev Exchange et rejoignez la communauté des développeurs africains.',
};

export default function RegisterPage() {
  return (
    <Suspense>
      <LoginScreen initialMode="register" />
    </Suspense>
  );
}
