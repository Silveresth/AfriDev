'use client';

import { ThumbsUp, Clapperboard, Play } from 'lucide-react';
import Link from 'next/link';

import { useDataSaver } from '@/shared/data-saver';
import { formatCount, thumbhashToDataUrl } from '@/shared/lib';
import { absoluteMediaUrl, type MediaAsset } from '@/shared/media';
import { Button, EmptyState, Skeleton } from '@/shared/ui';

import { type Post, useFeed } from '../api';

/** Vidéos courtes d'un membre en miniatures verticales 9:16 (onglet « Vidéos & Tutos » du profil). */
export function AuthorVideos({ authorId }: { authorId: string }) {
  const feed = useFeed({ author: authorId, media: 'video', sort: 'new' });
  if (feed.isPending) {
    return (
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="aspect-[9/16] rounded-xl" />
        ))}
      </div>
    );
  }
  if (!feed.items.length) {
    return (
      <EmptyState icon={<Clapperboard aria-hidden />} title="Aucune vidéo pour l'instant">
        Les micro-démos et tutos vidéo apparaîtront ici.
      </EmptyState>
    );
  }
  return (
    <div className="space-y-4">
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {feed.items.map((post) => (
          <li key={post.id}>
            <VideoThumb post={post} />
          </li>
        ))}
      </ul>
      {feed.hasNextPage ? (
        <Button variant="ghost" className="w-full" onClick={() => feed.fetchNextPage()} loading={feed.isFetchingNextPage}>
          Charger plus
        </Button>
      ) : null}
    </div>
  );
}

function VideoThumb({ post }: { post: Post }) {
  const { textOnly } = useDataSaver();
  // Le schéma décrit `media` comme JSON libre : c'est la forme de /api/media/<id>/.
  const media = post.media as MediaAsset | null;
  const placeholder = thumbhashToDataUrl(media?.thumbhash ?? '');
  // Mode « Texte seul » : aucune image téléchargée, seulement l'aperçu flou local.
  const poster = textOnly ? undefined : absoluteMediaUrl(media?.urls.poster);
  const title = post.title || post.body;
  return (
    <Link
      href={`/feed/${post.id}`}
      className="group relative block aspect-[9/16] overflow-hidden rounded-xl bg-container ring-1 ring-line"
      style={{ backgroundImage: placeholder ? `url(${placeholder})` : undefined, backgroundSize: 'cover' }}
    >
      {poster ? (
        // eslint-disable-next-line @next/next/no-img-element -- affiche WebP déjà produite par le backend
        <img src={poster} alt="" loading="lazy" decoding="async" className="absolute inset-0 size-full object-cover transition-transform duration-300 group-hover:scale-105" />
      ) : null}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" aria-hidden />
      <span className="absolute top-2 right-2 flex size-8 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm">
        <Play className="size-4" aria-hidden />
      </span>
      <div className="absolute inset-x-0 bottom-0 space-y-1 p-2.5 text-white">
        <p className="line-clamp-2 text-body-sm font-semibold">{title}</p>
        <p className="flex items-center gap-2 text-label-md text-white/80 tabular-nums">
          <span className="flex items-center gap-0.5">
            <ThumbsUp className="size-3.5" aria-hidden /> {formatCount(post.score)}
          </span>
          {media?.duration_seconds ? <span>{Math.round(media.duration_seconds)} s</span> : null}
        </p>
      </div>
    </Link>
  );
}
