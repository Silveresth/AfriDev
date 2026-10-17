import type { Metadata } from 'next';
import { Suspense } from 'react';

import { MessagesScreen } from '@/features/messaging';

export const metadata: Metadata = { title: 'Messages', robots: { index: false } };

export default function MessagesPage() {
  return (
    <Suspense>
      <MessagesScreen />
    </Suspense>
  );
}