import type { Schemas } from '@afridev/api-client';
import type { Metadata } from 'next';

import { SnippetDetail } from '@/features/snippets';
import { serverGet } from '@/shared/api/server';

type Props = { params: Promise<{ id: string }> };

const getSnippet = (id: string) =>
  serverGet<Schemas['PublicSnippet']>(`/api/snippets/public/${encodeURIComponent(id)}/`);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const snippet = await getSnippet((await params).id);
  if (!snippet) return { title: 'Snippet' };
  return {
    title: snippet.title,
    description: `Snippet ${snippet.language}${snippet.tags.length ? ` · ${snippet.tags.join(', ')}` : ''}`,
  };
}

export default async function SnippetPage({ params }: Props) {
  const { id } = await params;
  const snippet = await getSnippet(id);
  return <SnippetDetail id={id} initial={snippet ?? undefined} />;
}
