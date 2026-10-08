'use client';

import { Code2, Plus } from 'lucide-react';

import { useSession } from '@/shared/session';
import { Button, ButtonLink, CardSkeleton, EmptyState, ErrorNotice } from '@/shared/ui';

import { useSnippetsByHub } from '../api';
import { SnippetCard } from './SnippetCard';

/** Snippets publics partagés dans un hub (onglet de /h/<slug>). */
export function HubSnippets({ hub }: { hub: string }) {
  const { isAuthenticated } = useSession();
  const snippets = useSnippetsByHub(hub);
  if (snippets.isPending) return <CardSkeleton lines={4} />;
  if (snippets.isError && !snippets.items.length) {
    return <ErrorNotice message="Les snippets du hub s'afficheront dès le retour du réseau." />;
  }
  if (!snippets.items.length) {
    return (
      <EmptyState
        icon={<Code2 aria-hidden />}
        title="Aucun snippet partagé ici"
        action={
          isAuthenticated ? (
            <ButtonLink href="/snippets/new">
              <Plus className="size-4" aria-hidden /> Partager un snippet
            </ButtonLink>
          ) : undefined
        }
      >
        Publiez un snippet de votre coffre et rattachez-le à ce hub.
      </EmptyState>
    );
  }
  return (
    <div className="space-y-4">
      {snippets.items.map((snippet) => (
        <SnippetCard key={snippet.id} snippet={{ ...snippet, date: snippet.published_at, dateLabel: 'Publié' }} />
      ))}
      {snippets.hasNextPage ? (
        <Button variant="outline" className="w-full" onClick={() => snippets.fetchNextPage()} loading={snippets.isFetchingNextPage}>
          Voir plus de snippets
        </Button>
      ) : null}
    </div>
  );
}
