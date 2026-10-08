import type { Metadata } from 'next';
import { Suspense } from 'react';

import { FeedScreen, TrendingCard } from '@/features/feed';
import { RecommendedHubsCard } from '@/features/hubs';
import { RecentJobsCard, UpcomingEventsCard } from '@/features/jobs-events';
import { OpenQuestionsCard } from '@/features/qa';
import { CardSkeleton } from '@/shared/ui';

export const metadata: Metadata = { title: "Fil d'actualité" };

export default function FeedPage() {
  return (
    <Suspense fallback={<CardSkeleton />}>
      <FeedScreen
        aside={
          <>
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
