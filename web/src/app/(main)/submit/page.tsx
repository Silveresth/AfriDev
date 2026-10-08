import type { Metadata } from 'next';
import { Suspense } from 'react';

import { SubmitScreen } from '@/features/feed';
import { CardSkeleton } from '@/shared/ui';

export const metadata: Metadata = { title: 'Créer un post' };

export default function SubmitPage() {
  return (
    <Suspense fallback={<CardSkeleton />}>
      <SubmitScreen />
    </Suspense>
  );
}