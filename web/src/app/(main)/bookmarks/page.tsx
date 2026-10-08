import type { Metadata } from 'next';

import { BookmarksScreen } from '@/features/bookmarks';

export const metadata: Metadata = { title: 'Marque-pages' };

export default function BookmarksPage() {
  return <BookmarksScreen />;
}
