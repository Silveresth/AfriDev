import type { Metadata } from 'next';

import { VerifyTwoFactorScreen } from '@/features/auth';

export const metadata: Metadata = { title: 'Double authentification' };

export default function VerifyTwoFactorPage() {
  return <VerifyTwoFactorScreen />;
}
