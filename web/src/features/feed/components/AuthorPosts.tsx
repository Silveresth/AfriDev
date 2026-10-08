'use client';

import { Button, CardSkeleton, EmptyState } from '@/shared/ui';

import { useFeed } from '../api';
import { PostCard } from './PostCard';

/** Posts d'un membre (onglet du profil). */
export function AuthorPosts({ authorId }: { authorId: string }) {
  const feed = useFeed({ author: authorId });
  if (feed.isPending) return <CardSkeleton />;
  if (!feed.items.length) return <EmptyState title="Aucun post publié" />;
  return (
    <div className="space-y-4">
      {feed.items.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
      {feed.hasNextPage ? (
        <Button variant="ghost" className="w-full" onClick={() => feed.fetchNextPage()} loading={feed.isFetchingNextPage}>
          Charger plus
        </Button>
      ) : null}
    </div>
  );
}
