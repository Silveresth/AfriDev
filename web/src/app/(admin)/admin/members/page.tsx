import type { Metadata } from 'next';

import { MembersScreen } from '@/features/backoffice';

export const metadata: Metadata = { title: 'Membres' };

export default function AdminMembersPage() {
  return <MembersScreen />;
}