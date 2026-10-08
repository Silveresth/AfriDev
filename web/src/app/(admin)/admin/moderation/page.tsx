import type { Metadata } from 'next';

import { ModerationScreen } from '@/features/backoffice';

export const metadata: Metadata = { title: 'Modération' };

export default function AdminModerationPage() {
  return <ModerationScreen />;
}