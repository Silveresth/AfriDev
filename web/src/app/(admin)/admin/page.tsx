import type { Metadata } from 'next';

import { DashboardScreen } from '@/features/backoffice';

export const metadata: Metadata = { title: 'Tableau de bord' };

export default function AdminDashboardPage() {
  return <DashboardScreen />;
}