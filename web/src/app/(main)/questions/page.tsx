import type { Metadata } from 'next';
import { Suspense } from 'react';

import { RecommendedHubsCard } from '@/features/hubs';
import { RecentJobsCard } from '@/features/jobs-events';
import { RecruitingProjectsCard } from '@/features/projects';
import { QuestionsScreen } from '@/features/qa';
import { CardSkeleton } from '@/shared/ui';

export const metadata: Metadata = {
  title: 'Entraide & IA',
  description: 'Questions techniques des développeurs africains, avec une première réponse IA instantanée.',
};

export default function QuestionsPage() {
  return (
    <Suspense fallback={<CardSkeleton />}>
      <QuestionsScreen
        aside={
          <>
            <RecommendedHubsCard />
            <RecentJobsCard />
            <RecruitingProjectsCard title="Projets qui recrutent" />
          </>
        }
      />
    </Suspense>
  );
}
