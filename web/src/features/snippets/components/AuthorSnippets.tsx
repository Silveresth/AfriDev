'use client';

import { CardSkeleton, EmptyState } from '@/shared/ui';

import { useSnippetsByAuthor } from '../api';
import { SnippetCard } from './SnippetCard';

/** Snippets publics d'un membre (onglet du profil). */
export function AuthorSnippets({ authorId }: { authorId: string }) {
  const snippets = useSnippetsByAuthor(authorId);
  if (snippets.isPending) return <CardSkeleton lines={4} />;
  if (!snippets.items.length) return <EmptyState title="Aucun snippet public" />;
  return (
    <div className="space-y-4">
      {snippets.items.map((snippet) => (
        <SnippetCard
          key={snippet.id}
          snippet={{ ...snippet, date: snippet.published_at, dateLabel: 'Publié' }}
        />
      ))}
    </div>
  );
}
