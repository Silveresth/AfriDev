import type { Metadata } from 'next';

import { SnippetEditorScreen } from '@/features/snippets';
import { RequireAuth } from '@/shared/session';

export const metadata: Metadata = { title: 'Modifier le snippet' };

export default async function EditSnippetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <RequireAuth>
      <SnippetEditorScreen id={id} />
    </RequireAuth>
  );
}
