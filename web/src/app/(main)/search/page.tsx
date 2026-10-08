import type { Metadata } from 'next';
import { Suspense } from 'react';

import { RecommendedHubsCard } from '@/features/hubs';
import { OpenQuestionsCard } from '@/features/qa';
import { SearchScreen, SearchTipsCard } from '@/features/search';

export const metadata: Metadata = { title: 'Explorer' };

export default function SearchPage() {
  return (
    <Suspense>
      <SearchScreen
        aside={
          <>
            <SearchTipsCard />
            <RecommendedHubsCard />
            <OpenQuestionsCard title="Entraide prioritaire" />
          </>
        }
      />
    </Suspense>
  );
}
