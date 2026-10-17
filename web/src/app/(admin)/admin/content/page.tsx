import type { Metadata } from 'next';

import { ContentScreen } from '@/features/backoffice';

export const metadata: Metadata = { title: 'Contenus' };

export default function AdminContentPage() {
  return <ContentScreen />;
}