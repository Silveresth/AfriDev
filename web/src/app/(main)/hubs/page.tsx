import type { Metadata } from 'next';
import { Suspense } from 'react';

import { HubsScreen } from '@/features/hubs';

export const metadata: Metadata = {
  title: 'Hubs',
  description: 'Les communautés tech africaines : par langage, par pays, par passion.',
};

export default function HubsPage() {
  // Suspense : HubsScreen lit ?create=1 (useSearchParams).
  return (
    <Suspense>
      <HubsScreen />
    </Suspense>
  );
}
