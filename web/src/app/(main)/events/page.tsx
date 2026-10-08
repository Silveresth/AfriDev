import type { Metadata } from 'next';

import { EventsScreen } from '@/features/jobs-events';

export const metadata: Metadata = {
  title: 'Événements tech',
  description: 'Meetups, hackathons et webinars tech en Afrique.',
};

export default function EventsPage() {
  return <EventsScreen />;
}
