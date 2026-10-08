import type { Metadata } from 'next';

import { JobsScreen } from '@/features/jobs-events';

export const metadata: Metadata = {
  title: 'Job Board',
  description: 'Offres d’emploi, missions freelance et stages tech en Afrique.',
};

export default function JobsPage() {
  return <JobsScreen />;
}
