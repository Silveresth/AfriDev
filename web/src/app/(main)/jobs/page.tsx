import type { Metadata } from 'next';
import { Suspense } from 'react';

import { JobsScreen } from '@/features/jobs-events';
import { CardSkeleton } from '@/shared/ui';

export const metadata: Metadata = {
  title: 'Job Board',
  description: 'Offres d’emploi, missions freelance et stages tech en Afrique.',
};

export default function JobsPage() {
  // Filtres lus dans l'adresse (recherche vocale : /jobs?q=django&remote=true).
  return (
    <Suspense fallback={<CardSkeleton />}>
      <JobsScreen />
    </Suspense>
  );
}
