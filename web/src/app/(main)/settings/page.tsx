import type { Metadata } from 'next';

import { SettingsScreen } from '@/features/settings';

export const metadata: Metadata = { title: 'Réglages' };

export default function SettingsPage() {
  return <SettingsScreen />;
}
