import type { Metadata } from 'next';

import { MySnippetsScreen } from '@/features/snippets';
import { RequireAuth } from '@/shared/session';

export const metadata: Metadata = { title: 'Mon coffre de snippets' };

export default function SnippetsPage() {
  return (
    <RequireAuth>
      <MySnippetsScreen />
    </RequireAuth>
  );
}
