import type { Metadata } from 'next';
import { Suspense } from 'react';

import { NewsScreen, TrendingCard } from '@/features/feed';
import { UpcomingEventsCard } from '@/features/jobs-events';
import { CardSkeleton } from '@/shared/ui';

export const metadata: Metadata = {
  title: 'Actu tech',
  description: 'Toute l’actualité tech du jour : Hacker News, DEV.to et les médias tech francophones et anglophones.',
};

export default function NewsPage() {
  return (
    <Suspense fallback={<CardSkeleton />}>
      <NewsScreen
        aside={
          <>
            <TrendingCard />
            <UpcomingEventsCard />
          </>
        }
      />
    </Suspense>
  );
}
