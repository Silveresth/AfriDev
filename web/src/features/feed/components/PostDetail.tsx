'use client';

import { ArrowLeft, MessagesSquare, Plus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { CommentThread } from '@/features/discussions';
import { HubAboutCard, RecommendedHubsCard } from '@/features/hubs';
import { TwoColumns } from '@/shared/layout';
import { formatCount } from '@/shared/lib';
import { useSession } from '@/shared/session';
import { buttonClasses, CardSkeleton, CommunityIcon, ErrorNotice, SideCard } from '@/shared/ui';

import { type Post, useCommunities, usePost } from '../api';
import { PostCard } from './PostCard';

/** Un post et sa discussion, comme la page d'un post Reddit. */
export function PostDetail({ id, initial }: { id: string; initial?: Post }) {
  const post = usePost(id, initial);
  const router = useRouter();
  const community = post.data?.tags[0];
  return (
    <TwoColumns
      aside={
        post.data?.hub ? (
          <>
            <HubAboutCard slug={post.data.hub.slug} />
            <RecommendedHubsCard />
          </>
        ) : community ? (
          <AboutCommunity tag={community} />
        ) : (
          <RecommendedHubsCard />
        )
      }
    >
      <div className="flex items-start gap-2 sm:gap-3">
        <button
          type="button"
          aria-label="Retour"
          onClick={() => (window.history.length > 1 ? router.back() : router.push('/feed'))}
          className={buttonClasses({ variant: 'outline', size: 'icon', className: 'hidden rounded-full sm:inline-flex' })}
        >
          <ArrowLeft className="size-4" aria-hidden />
        </button>
        <div className="min-w-0 flex-1">
          {post.data ? (
            <PostCard post={post.data} detail />
          ) : post.isError ? (
            <ErrorNotice title="Post introuvable" message="Il a peut-être été supprimé, ou n'est pas encore disponible hors ligne." />
          ) : (
            <CardSkeleton lines={4} />
          )}
        </div>
      </div>
      {post.data ? (
        <div id="commentaires" className="scroll-mt-24 rounded-2xl border border-line bg-card p-4 shadow-card sm:ml-12 sm:p-5">
          <CommentThread postId={post.data.id} commentCount={post.data.comment_count} />
        </div>
      ) : null}
    </TwoColumns>
  );
}

/** « À propos de la communauté » (colonne de droite d'un post). */
function AboutCommunity({ tag }: { tag: string }) {
  const communities = useCommunities(50);
  const { isAuthenticated } = useSession();
  const stats = communities.data?.find((community) => community.tag === tag);
  return (
    <>
      <SideCard>
        <div className="space-y-3 p-4">
          <Link href={`/feed?tag=${encodeURIComponent(tag)}`} className="flex items-center gap-3 hover:underline">
            <CommunityIcon tag={tag} size={40} className="rounded-lg" />
            <span className="text-headline-md text-ink">d/{tag}</span>
          </Link>
          {stats ? (
            <dl className="grid grid-cols-2 gap-2">
              <div>
                <dt className="text-label-md text-ink-muted">Publications</dt>
                <dd className="font-semibold text-ink tabular-nums">{formatCount(stats.posts)}</dd>
              </div>
              <div>
                <dt className="text-label-md text-ink-muted">Questions</dt>
                <dd className="font-semibold text-ink tabular-nums">{formatCount(stats.questions)}</dd>
              </div>
            </dl>
          ) : null}
          <p className="text-body-sm text-ink-muted">Activité des 90 derniers jours sur AfriDev.</p>
          <div className="flex flex-wrap gap-2">
            {isAuthenticated ? (
              <Link href={`/submit?tag=${encodeURIComponent(tag)}`} className={buttonClasses({ size: 'sm' })}>
                <Plus className="size-4" aria-hidden /> Créer un post
              </Link>
            ) : null}
            <Link href={`/questions?tag=${encodeURIComponent(tag)}`} className={buttonClasses({ variant: 'outline', size: 'sm' })}>
              <MessagesSquare className="size-4" aria-hidden /> Questions
            </Link>
          </div>
        </div>
      </SideCard>
      <RecommendedHubsCard />
    </>
  );
}
