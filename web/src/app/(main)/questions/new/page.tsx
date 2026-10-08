import type { Metadata } from 'next';
import { Suspense } from 'react';

import { AskQuestionScreen } from '@/features/qa';
import { RequireAuth } from '@/shared/session';
import { CardSkeleton } from '@/shared/ui';

export const metadata: Metadata = { title: 'Poser une question' };

export default function NewQuestionPage() {
  return (
    <RequireAuth>
      <Suspense fallback={<CardSkeleton />}>
        <AskQuestionScreen />
      </Suspense>
    </RequireAuth>
  );
}
