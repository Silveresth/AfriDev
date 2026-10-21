'use client';

import type { Schemas } from '@afridev/api-client';
import { linkDomain } from '@afridev/validation';
import { Clock, ExternalLink, Globe, Play, Sparkles } from 'lucide-react';
import { useState } from 'react';

import { useDataSaver } from '@/shared/data-saver';
import { cn } from '@/shared/lib';

type LinkPreview = NonNullable<Schemas['PostOutput']['link_preview']>;

/**
 * Bannière de la ressource d'un post, comme une image : vignette, site, titre, description.
 * Tout le bloc mène à la ressource (nouvel onglet, sans transmettre la page d'origine).
 * Carte pas encore prête ou page sans image : bannière compacte (domaine et adresse).
 * `detail` : résumé IA et temps de lecture sous la bannière.
 */
export function LinkCard({ url, preview, detail = false }: { url: string; preview?: LinkPreview | null; detail?: boolean }) {
  const { textOnly } = useDataSaver();
  const [broken, setBroken] = useState(false);
  const ready = preview?.status === 'ready';
  const domain = preview?.domain || linkDomain(url);
  const image = ready && preview.image_url && !broken && !textOnly ? preview.image_url : '';
  const title = ready ? preview.title : '';
  const summary = detail && ready ? preview.summary : [];

  return (
    <div className="mt-3 space-y-2">
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer nofollow ugc"
        className="group/link block overflow-hidden rounded-xl border border-line bg-card transition-colors hover:border-primary/40"
      >
        {image ? (
          <div className="relative aspect-[1.91/1] max-h-80 w-full overflow-hidden bg-container">
            {/* eslint-disable-next-line @next/next/no-img-element -- image externe (aperçu de la ressource) */}
            <img
              src={image}
              alt=""
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
              onError={() => setBroken(true)}
              className="size-full object-cover transition-transform duration-300 group-hover/link:scale-[1.02]"
            />
            {preview?.kind === 'video' ? (
              <span className="absolute inset-0 flex items-center justify-center">
                <span className="flex size-14 items-center justify-center rounded-full bg-black/60 text-white shadow-lg backdrop-blur-sm">
                  <Play className="size-7 fill-current" aria-hidden />
                </span>
              </span>
            ) : null}
          </div>
        ) : null}
        <div className={cn('flex items-center gap-3', image ? 'px-3.5 py-3' : 'px-3 py-2.5')}>
          {!image ? (
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-container-low text-primary-ink">
              <Globe className="size-4" aria-hidden />
            </span>
          ) : null}
          <span className="min-w-0 flex-1">
            <span className="block truncate text-label-md font-semibold tracking-wide text-ink-faint uppercase">
              {ready && preview.site_name && preview.site_name !== domain ? `${preview.site_name} · ${domain}` : domain}
            </span>
            <span className="mt-0.5 line-clamp-2 block text-body-md font-semibold text-ink group-hover/link:text-primary-ink">
              {title || url.replace(/^https?:\/\/(www\.)?/i, '')}
            </span>
            {ready && preview.description ? (
              <span className="mt-0.5 line-clamp-2 block text-body-sm text-ink-muted">{preview.description}</span>
            ) : null}
          </span>
          <span className="flex shrink-0 items-center gap-1 text-body-sm font-semibold text-primary-ink">
            <span className={detail ? undefined : 'hidden sm:inline'}>Ouvrir</span>
            <ExternalLink className="size-4" aria-hidden />
          </span>
        </div>
      </a>

      {summary.length || (detail && ready && preview.reading_minutes) ? (
        <div className="rounded-xl bg-secondary-soft/50 px-4 py-3">
          <p className="mb-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-body-sm font-bold text-on-secondary-soft">
            {summary.length ? (
              <span className="flex items-center gap-1.5">
                <Sparkles className="size-4" aria-hidden /> En bref (résumé IA)
              </span>
            ) : null}
            {preview?.reading_minutes ? (
              <span className="flex items-center gap-1 font-medium opacity-80">
                <Clock className="size-3.5" aria-hidden /> {preview.reading_minutes} min de lecture
              </span>
            ) : null}
          </p>
          {summary.length ? (
            <ul className="list-disc space-y-1 pl-5 text-body-sm text-ink">
              {summary.map((point, index) => (
                <li key={index}>{point}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
