'use client';

import { ImageIcon, Play } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { API_URL } from '@/shared/api/config';
import { useDataSaver } from '@/shared/data-saver';
import { cn, thumbhashToDataUrl } from '@/shared/lib';

import type { MediaAsset } from './upload';

/**
 * Affichage économe d'un média :
 * - aperçu flou ThumbHash (quelques octets) tout de suite ;
 * - en mode « Texte seul », rien n'est téléchargé avant un toucher explicite ;
 * - la vidéo ne démarre jamais seule et hls.js n'est chargé qu'au clic.
 */
/** L'API sert les fichiers en chemins relatifs (/media/…) : ils vivent sur l'API, pas sur le site. */
function absolute(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  return url.startsWith('/') ? `${API_URL}${url}` : url;
}

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

  if (media.kind === 'video') return <VideoPlayer media={media} placeholder={placeholder} className={className} />;
  if (media.kind === 'audio') {
    return <audio controls preload="none" src={media.urls.opus ?? media.original_url} className="w-full" />;
  }

  const small = media.urls.small ?? media.original_url;
  const large = media.urls.large ?? media.original_url;
  return (
    <div
      className={cn('overflow-hidden rounded border border-line bg-container', className)}
      style={{ aspectRatio: ratio, maxHeight: 520, backgroundImage: placeholder ? `url(${placeholder})` : undefined, backgroundSize: 'cover' }}
    >
      <picture>
        {media.urls.avif ? <source srcSet={media.urls.avif} type="image/avif" media="(min-width: 768px)" /> : null}
        {/* Variantes WebP/AVIF déjà produites par le backend : pas besoin de next/image. */}
        <img
          src={small}
          srcSet={`${small} 480w, ${large} 1280w`}
          sizes="(min-width: 1024px) 640px, 100vw"
          alt={alt}
          loading="lazy"
          decoding="async"
          className="size-full object-cover"
        />
      </picture>
    </div>
  );
}

function VideoPlayer({ media, placeholder, className }: { media: MediaAsset; placeholder?: string; className?: string }) {
  const { maxVideoHeight } = useDataSaver();
  const [playing, setPlaying] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const hls = media.urls.hls;
  const poster = media.urls.poster ?? placeholder;

  useEffect(() => {
    const element = video.current;
    if (!playing || !element) return;
    if (!hls || element.canPlayType('application/vnd.apple.mpegurl')) {
      element.src = hls ?? media.original_url;
      void element.play().catch(() => {});
      return;
    }
    let destroy: (() => void) | undefined;
    void import('hls.js').then(({ default: Hls }) => {
      if (!Hls.isSupported()) {
        element.src = media.original_url;
        return;
      }
      const player = new Hls({ capLevelToPlayerSize: true, startLevel: 0 });
      player.on(Hls.Events.MANIFEST_PARSED, () => {
        // Plafonne la qualité selon le réglage « Qualité vidéo » et le réseau.
        const allowed = player.levels.map((level, index) => ({ index, height: level.height })).filter((l) => l.height <= maxVideoHeight);
        player.autoLevelCapping = allowed.length ? allowed[allowed.length - 1]!.index : 0;
        void element.play().catch(() => {});
      });
      player.loadSource(hls);
      player.attachMedia(element);
      destroy = () => player.destroy();
    });
    return () => destroy?.();
  }, [playing, hls, media.original_url, maxVideoHeight]);

  return (
    <div className={cn('relative overflow-hidden rounded border border-line bg-black', className)} style={{ aspectRatio: '9 / 16', maxHeight: 520 }}>
      <video
        ref={video}
        poster={poster}
        controls={playing}
        playsInline
        preload="none"
        className="size-full object-contain"
      />
      {!playing ? (
        <button
          type="button"
          onClick={() => setPlaying(true)}
          className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/30 text-white"
        >
          <span className="flex size-14 items-center justify-center rounded-lg bg-primary">
            <Play className="size-7" aria-hidden />
          </span>
          <span className="text-body-md font-semibold">Lire la vidéo</span>
          <span className="font-mono text-label-sm text-white/80">
            Pas de lecture automatique · {media.duration_seconds ? `${Math.round(media.duration_seconds)} s` : 'vidéo courte'}
          </span>
        </button>
      ) : null}
    </div>
  );
}
