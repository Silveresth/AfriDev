'use client';

import { Flame, Newspaper, PenSquare, Sparkles, TrendingUp } from 'lucide-react';
import { useState } from 'react';

import { useSession } from '@/shared/session';
import { Button, ButtonLink, CardSkeleton, EmptyState, ErrorNotice, Segmented } from '@/shared/ui';

import { type FeedSort, useFeed } from '../api';
import { PostCard } from './PostCard';

/** Discussions d'un hub (onglet de /h/<slug>), triées comme le fil. */
export function HubPosts({ hub }: { hub: string }) {
  const { isAuthenticated } = useSession();
  const [sort, setSort] = useState<FeedSort>('hot');
  const feed = useFeed({ hub, sort });

  return (
    <div className="space-y-3">
      <Segmented<FeedSort>
        value={sort}
        onChange={setSort}
        options={[
          { value: 'hot', label: <><Flame className="size-3.5" aria-hidden /> Populaires</> },
          { value: 'new', label: <><Sparkles className="size-3.5" aria-hidden /> Nouveaux</> },
          { value: 'top', label: <><TrendingUp className="size-3.5" aria-hidden /> Top</> },
        ]}
      />
      {feed.isPending ? (
        <CardSkeleton lines={3} />
      ) : feed.isError && !feed.items.length ? (
        <ErrorNotice message="Les discussions du hub s'afficheront dès le retour du réseau." />
      ) : !feed.items.length ? (
        <EmptyState
          icon={<Newspaper aria-hidden />}
          title="Aucune discussion pour l'instant"
          action={
            isAuthenticated ? (
              <ButtonLink href={`/submit?hub=${encodeURIComponent(hub)}`}>
                <PenSquare className="size-4" aria-hidden /> Lancer la première
              </ButtonLink>
            ) : undefined
          }
        >
          Partagez une astuce, une question ouverte ou un retour d&apos;expérience avec les membres.
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {feed.items.map((post) => (
            <li key={post.id}>
              <PostCard post={post} />
            </li>
          ))}
        </ul>
      )}
      {feed.hasNextPage ? (
        <Button variant="outline" className="w-full" onClick={() => feed.fetchNextPage()} loading={feed.isFetchingNextPage}>
          Voir plus de discussions
        </Button>
      ) : null}
    </div>
  );
}
