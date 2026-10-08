import type { Metadata } from 'next';

import { SnippetEditorScreen } from '@/features/snippets';
import { RequireAuth } from '@/shared/session';

export const metadata: Metadata = { title: 'Nouveau snippet' };

export default function NewSnippetPage() {
  return (
    <RequireAuth>
      <SnippetEditorScreen />
    </RequireAuth>
  );
}
