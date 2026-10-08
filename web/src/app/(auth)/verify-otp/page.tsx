import type { Metadata } from 'next';

import { VerifyOtpScreen } from '@/features/auth';

export const metadata: Metadata = { title: 'Code de confirmation' };

export default function VerifyOtpPage() {
  return <VerifyOtpScreen />;
}
