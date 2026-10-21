'use client';

import { ImageIcon, Play } from 'lucide-react';
import { useState } from 'react';

import { useDataSaver } from '@/shared/data-saver';
import { cn, thumbhashToDataUrl } from '@/shared/lib';

import { absoluteMediaUrl as absolute, type MediaAsset } from './upload';
import { VideoPlayer } from './video';

/**
 * Affichage économe d'un média :
 * - aperçu flou ThumbHash (quelques octets) tout de suite ;
 * - en mode « Texte seul », rien n'est téléchargé avant un toucher explicite ;
 * - la vidéo ne démarre jamais seule et hls.js n'est chargé qu'au clic.
 */
function withAbsoluteUrls(media: MediaAsset): MediaAsset {
  const urls = Object.fromEntries(Object.entries(media.urls).map(([key, url]) => [key, absolute(url)]));
  return { ...media, original_url: absolute(media.original_url) ?? media.original_url, urls: urls as MediaAsset['urls'] };
}

export function MediaView({ media: raw, alt = '', className }: { media: MediaAsset; alt?: string; className?: string }) {
  const media = withAbsoluteUrls(raw);
  const { textOnly } = useDataSaver();
  const [revealed, setRevealed] = useState(false);
  const placeholder = thumbhashToDataUrl(media.thumbhash);
  const ratio = media.width && media.height ? `${media.width} / ${media.height}` : '16 / 9';

  if (media.status !== 'ready') {
    return (
      <div className={cn('flex aspect-video items-center justify-center rounded border border-line bg-container text-body-sm text-ink-muted', className)}>
        {media.status === 'failed' ? 'Ce média n’a pas pu être traité.' : 'Média en cours de traitement…'}
      </div>
    );
  }

  if (textOnly && !revealed) {
    return (
      <button
        type="button"
        onClick={() => setRevealed(true)}
        className={cn('relative flex w-full items-center justify-center overflow-hidden rounded border border-line bg-container', className)}
        style={{ aspectRatio: ratio, maxHeight: 420 }}
      >
        {placeholder ? (
          // eslint-disable-next-line @next/next/no-img-element -- aperçu data: local, 0 octet réseau
          <img src={placeholder} alt="" className="absolute inset-0 size-full object-cover opacity-70" />
        ) : null}
        <span className="relative flex items-center gap-2 rounded bg-card/90 px-3 py-2 text-body-sm text-ink">
          {media.kind === 'video' ? <Play className="size-4" aria-hidden /> : <ImageIcon className="size-4" aria-hidden />}
          Mode texte : toucher pour charger
        </span>
      </button>
    );
  }

  if (media.kind === 'video') return <PostVideo media={media} placeholder={placeholder} className={className} />;
  if (media.kind === 'audio') {
    return <audio controls preload="none" src={media.urls.opus ?? media.original_url} className="w-full" />;
  }

  const small = media.urls.small ?? media.original_url;
  const large = media.urls.large ?? media.original_url;
  const { shown, fits } = displayRatio(media.width, media.height);
  return (
    <div
      className={cn('relative w-full overflow-hidden rounded border border-line bg-container', className)}
      style={{ aspectRatio: shown }}
    >
      {/* Image hors cadre (très haute ou très large) : affichée en entier sur son propre aperçu flou. */}
      {placeholder ? (
        // eslint-disable-next-line @next/next/no-img-element -- aperçu data: local, 0 octet réseau
        <img src={placeholder} alt="" aria-hidden className={cn('absolute inset-0 size-full object-cover', fits ? '' : 'scale-110 blur-xl')} />
      ) : null}
      <picture className="absolute inset-0">
        {media.urls.avif ? <source srcSet={media.urls.avif} type="image/avif" media="(min-width: 768px)" /> : null}
        {/* Variantes WebP/AVIF déjà produites par le backend : pas besoin de next/image. */}
        <img
          src={small}
          srcSet={`${small} 480w, ${large} 1280w`}
          sizes="(min-width: 1024px) 640px, 100vw"
          alt={alt}
          loading="lazy"
          decoding="async"
          className={cn('size-full', fits ? 'object-cover' : 'object-contain')}
        />
      </picture>
    </div>
  );
}

/**
 * Cadre d'une image de post : son propre format tant qu'il reste raisonnable (du carré au
 * paysage 1,91:1) ; au-delà, cadre borné et image entière, jamais rognée.
 */
function displayRatio(width?: number | null, height?: number | null) {
  const natural = width && height ? width / height : 16 / 9;
  const shown = Math.min(1.91, Math.max(1, natural));
  return { shown, fits: Math.abs(shown - natural) < 0.02 };
}

/** Cadre d'une vidéo : son propre format, borné entre le portrait 9:16 et le paysage 16:9. */
function videoRatio(width?: number | null, height?: number | null) {
  const natural = width && height ? width / height : 9 / 16;
  return String(Math.min(16 / 9, Math.max(9 / 16, natural)));
}

function PostVideo({ media, placeholder, className }: { media: MediaAsset; placeholder?: string; className?: string }) {
  return (
    <VideoPlayer
      src={media.urls.mp4 ?? media.original_url}
      hls={media.urls.hls}
      poster={media.urls.poster ?? placeholder}
      durationSeconds={media.duration_seconds}
      aspectRatio={videoRatio(media.width, media.height)}
      className={className}
    />
  );
}
