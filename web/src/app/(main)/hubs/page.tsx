import type { Metadata } from 'next';

import { HubsScreen } from '@/features/hubs';

export const metadata: Metadata = {
  title: 'Hubs',
  description: 'Les communautés tech africaines : par langage, par pays, par passion.',
};

export default function HubsPage() {
  return <HubsScreen />;
}
