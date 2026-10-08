'use client';

import { Flame, MessagesSquare, Plus, TrendingUp, UsersRound } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

import { cn, formatCount } from '@/shared/lib';
import { useSession } from '@/shared/session';
import { buttonClasses, CommunityIcon, profileColorHex, SideCard, Skeleton } from '@/shared/ui';

import { useCommunities, useFeed } from '../api';

const activity = (posts: number, questions: number) => {
  const total = posts + questions;
  return `${formatCount(total)} ${total > 1 ? 'publications' : 'publication'}`;
};

/** Communautés du menu latéral (d/python, d/mobile-money…). */
export function CommunityNav() {
  return (
    <Suspense fallback={<Skeleton className="mx-2.5 h-24" />}>
      <CommunityNavList />
    </Suspense>
  );
}

function CommunityNavList() {
  const communities = useCommunities(8);
  const pathname = usePathname();
  const params = useSearchParams();
  const current = pathname === '/feed' ? params.get('tag') : null;

  if (communities.isPending) return <Skeleton className="mx-2.5 h-24" />;
  if (!communities.data?.length) {
    return <p className="px-2.5 text-body-sm text-ink-faint">Les communautés apparaissent avec les premiers tags publiés.</p>;
  }
  return (
    <ul className="space-y-0.5">
      {communities.data.map((community) => (
        <li key={community.tag}>
          <Link
            href={`/feed?tag=${encodeURIComponent(community.tag)}`}
            aria-current={current === community.tag ? 'page' : undefined}
            className={cn(
              'flex h-9 items-center gap-3 rounded-lg px-2.5 text-body-md transition-colors',
              current === community.tag ? 'bg-container font-medium text-ink' : 'text-ink-muted hover:bg-container-low hover:text-ink',
            )}
          >
            <CommunityIcon tag={community.tag} size={20} />
            <span className="truncate">d/{community.tag}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** « Hubs recommandés » de la colonne de droite (communautés les plus actives). */
export function PopularCommunitiesCard({ title = 'Hubs recommandés' }: { title?: string }) {
  const communities = useCommunities(6);
  return (
    <SideCard title={title} icon={<UsersRound aria-hidden />}>
      {communities.isPending ? (
        <div className="px-4 pb-4">
          <Skeleton className="h-28" />
        </div>
      ) : communities.data?.length ? (
        <ol className="pb-1.5">
          {communities.data.map((community) => (
            <li key={community.tag}>
              <Link
                href={`/feed?tag=${encodeURIComponent(community.tag)}`}
                className="flex items-center gap-3 px-4 py-2 transition-colors hover:bg-container-low"
              >
                <CommunityIcon tag={community.tag} size={32} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body-sm font-medium text-ink">d/{community.tag}</span>
                  <span className="block text-label-md text-ink-faint">{activity(community.posts, community.questions)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      ) : (
        <p className="px-4 pb-4 text-body-sm text-ink-muted">Ajoutez des tags à vos publications pour faire naître des communautés.</p>
      )}
    </SideCard>
  );
}

/**
 * « Tendances tech en Afrique » : sujets (tags) les plus actifs et discussions les mieux notées.
 * Les deux listes viennent du cache local : le widget reste lisible hors ligne.
 */
export function TrendingCard() {
  const communities = useCommunities(12);
  const top = useFeed({ sort: 'top' });
  const posts = top.items.slice(0, 4);
  const tags = (communities.data ?? []).slice(0, 8);
  return (
    <SideCard title="Tendances tech en Afrique" icon={<TrendingUp aria-hidden />}>
      {tags.length ? (
        <div className="flex flex-wrap gap-1.5 px-4 pb-3">
          {tags.map((community) => (
            <Link
              key={community.tag}
              href={`/feed?tag=${encodeURIComponent(community.tag)}`}
              className="inline-flex h-7 items-center gap-1 rounded-full border border-line px-2.5 text-label-md font-medium text-ink-muted transition-colors hover:border-line-strong hover:text-ink"
            >
              <span className="text-ink-faint">#</span>
              {community.tag}
            </Link>
          ))}
        </div>
      ) : null}
      {top.isPending ? (
        <div className="px-4 pb-4">
          <Skeleton className="h-24" />
        </div>
      ) : posts.length ? (
        <ol className="border-t border-line py-1.5">
          {posts.map((post, index) => (
            <li key={post.id}>
              <Link href={`/feed/${post.id}`} className="flex gap-3 px-4 py-2 transition-colors hover:bg-container-low">
                <span className="w-4 shrink-0 pt-px text-body-sm font-semibold text-ink-faint tabular-nums">{index + 1}</span>
                <span className="min-w-0">
                  <span className="line-clamp-2 text-body-sm font-medium text-ink">{post.title || post.body.slice(0, 90)}</span>
                  <span className="mt-0.5 flex items-center gap-1 text-label-md text-ink-faint">
                    <Flame className="size-3" aria-hidden /> {formatCount(post.score ?? 0)} points · {formatCount(post.comment_count)} commentaires
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      ) : !tags.length ? (
        <p className="px-4 pb-4 text-body-sm text-ink-muted">Les tendances apparaîtront avec les premières publications.</p>
      ) : null}
    </SideCard>
  );
}

/** En-tête d'une communauté (fil filtré par tag), comme la page d'un subreddit. */
export function CommunityHeader({ tag }: { tag: string }) {
  const communities = useCommunities(50);
  const { isAuthenticated } = useSession();
  const stats = communities.data?.find((community) => community.tag === tag);
  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-card shadow-card">
      <div className="relative h-20 sm:h-24" style={{ backgroundColor: profileColorHex(tag) }} aria-hidden>
        <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.2)_1px,transparent_1.2px)] bg-[length:14px_14px] [mask-image:linear-gradient(105deg,transparent_10%,black_75%)]" />
        <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-black/15" />
      </div>
      <div className="flex flex-wrap items-end gap-x-4 gap-y-3 px-4 pb-4 sm:px-5">
        <CommunityIcon tag={tag} size={72} className="-mt-9 rounded-xl border-4 border-card text-[1.75rem]" />
        <div className="min-w-0 flex-1">
          <h1 className="text-headline-lg text-ink">d/{tag}</h1>
          <p className="text-body-sm text-ink-muted">
            {stats ? `${activity(stats.posts, stats.questions)} ces 90 derniers jours` : 'Communauté AfriDev'}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href={`/questions?tag=${encodeURIComponent(tag)}`} className={buttonClasses({ variant: 'outline' })}>
            <MessagesSquare className="size-4" aria-hidden /> Questions
          </Link>
          {isAuthenticated ? (
            <Link href={`/submit?tag=${encodeURIComponent(tag)}`} className={buttonClasses()}>
              <Plus className="size-4" aria-hidden /> Créer un post
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  );
}
