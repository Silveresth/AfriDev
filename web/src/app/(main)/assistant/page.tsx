import type { Metadata } from 'next';
import { Suspense } from 'react';

import { AssistantScreen } from '@/features/assistant';

export const metadata: Metadata = { title: 'Assistant IA' };

export default function AssistantPage() {
  return (
    <Suspense>
      <AssistantScreen />
    </Suspense>
  );
}
