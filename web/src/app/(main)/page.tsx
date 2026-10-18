import type { Metadata } from 'next';
import { Suspense } from 'react';

import { DigestCard } from '@/features/assistant';
import { FeedScreen, TechNewsCard, TrendingCard } from '@/features/feed';
import { RecommendedHubsCard } from '@/features/hubs';
import { RecentJobsCard, UpcomingEventsCard } from '@/features/jobs-events';
import { OpenQuestionsCard } from '@/features/qa';
import { CardSkeleton } from '@/shared/ui';

export const metadata: Metadata = {
  title: 'AfriDev — Plateforme d’échange des développeurs africains',
  description: 'Fil d’actualités, entraide Q&A, snippets, projets open source et opportunités tech panafricaines.',
};

export default function HomePage() {
  return (
    <Suspense fallback={<CardSkeleton />}>
      <FeedScreen
        aside={
          <>
            <DigestCard />
            <TechNewsCard />
            <TrendingCard />
            <RecommendedHubsCard />
            <RecentJobsCard />
            <UpcomingEventsCard />
            <OpenQuestionsCard title="Entraide prioritaire" />
          </>
        }
      />
    </Suspense>
  );
}
