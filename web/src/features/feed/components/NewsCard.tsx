'use client';

import { ArrowUpRight, Globe, MessageSquare, ThumbsUp } from 'lucide-react';
import { useState } from 'react';

import { useDataSaver } from '@/shared/data-saver';
import { formatCount, timeAgo } from '@/shared/lib';
import { Button, Dialog, Markdown, Tag } from '@/shared/ui';

import type { NewsItem } from '../api';

function SourceBadge({ item }: { item: NewsItem }) {
  const look =
    item.source === 'hackernews'
      ? { bg: 'bg-[#FF6600] text-white', label: 'Hacker News' }
      : item.source === 'devto'
        ? { bg: 'bg-ink text-surface', label: 'DEV.to' }
        : { bg: 'bg-container text-ink-muted', label: item.source_name };

  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${look.bg}`}>
      {look.label}
    </span>
  );
}

export function NewsCard({ item }: { item: NewsItem }) {
  const [open, setOpen] = useState(false);
  const { textOnly } = useDataSaver();

  return (
    <>
      <article
        onClick={() => setOpen(true)}
        className="group relative flex cursor-pointer flex-col rounded-2xl border border-line bg-card shadow-card transition-all hover:border-line-strong hover:shadow-raised sm:flex-row"
      >
        {/* Barre de score/votes latérale façon Reddit (sur écran sm+) */}
        {item.score !== null ? (
          <div className="hidden sm:flex w-14 shrink-0 flex-col items-center justify-start rounded-l-2xl border-r border-line/50 bg-container-low/40 py-4">
            <span className="flex size-7 items-center justify-center rounded-md text-ink-muted transition-colors group-hover:text-primary">
              <ThumbsUp className="size-4" aria-hidden />
            </span>
            <span className="text-xs font-bold text-ink mt-0.5">
              {formatCount(item.score)}
            </span>
          </div>
        ) : null}

        <div className="flex flex-1 flex-col justify-between p-4 sm:p-5">
          {/* En-tête métadonnées */}
          <div className="flex items-center justify-between gap-2 text-xs text-ink-muted mb-2">
            <div className="flex flex-wrap items-center gap-2">
              <SourceBadge item={item} />
              {item.lang === 'fr' ? (
                <span className="rounded bg-container-low px-1.5 py-0.5 text-[11px] font-semibold text-ink-muted">FR</span>
              ) : null}
              {item.published_at ? (
                <span>• {timeAgo(item.published_at)}</span>
              ) : null}
            </div>

            <span className="flex size-6 items-center justify-center rounded-full bg-container-low text-ink-muted transition-colors group-hover:bg-primary-soft group-hover:text-primary-ink">
              <ArrowUpRight className="size-3.5" aria-hidden />
            </span>
          </div>

          {/* Corps avec Titre, extrait et éventuelle miniature à droite */}
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1 space-y-1.5">
              <h3 className="text-headline-sm font-semibold text-ink group-hover:text-primary transition-colors leading-snug">
                {item.title}
              </h3>
              {item.excerpt ? (
                <p className="text-body-sm text-ink-muted line-clamp-2 leading-relaxed">
                  {item.excerpt}
                </p>
              ) : null}
            </div>

            {item.image_url && !textOnly ? (
              <div className="relative size-20 sm:size-24 shrink-0 overflow-hidden rounded-xl border border-line/60 bg-container">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.image_url}
                  alt={item.title}
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  loading="lazy"
                />
              </div>
            ) : null}
          </div>

          {/* Pied d'article avec actions & badges */}
          <div className="flex items-center justify-between border-t border-line/50 pt-3 mt-3 text-xs text-ink-muted">
            <div className="flex items-center gap-3">
              {/* Score sur mobile (affiché inline si pas de barre latérale) */}
              {item.score !== null ? (
                <span className="flex items-center gap-1 font-semibold text-ink sm:hidden">
                  <ThumbsUp className="size-3.5 text-primary" aria-hidden />
                  {formatCount(item.score)}
                </span>
              ) : null}

              {item.comment_count !== null ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-container-low px-2.5 py-1 text-ink-muted font-medium hover:text-ink">
                  <MessageSquare className="size-3.5" aria-hidden />
                  {formatCount(item.comment_count)} commentaires
                </span>
              ) : null}
            </div>

            <span className="text-[11px] font-medium text-ink-faint group-hover:text-primary transition-colors">
              Lire l&apos;aperçu →
            </span>
          </div>
        </div>
      </article>

      {/* Vue détaillée native dans un Dialog épuré */}
      <Dialog open={open} onClose={() => setOpen(false)} title={item.source_name}>
        <div className="space-y-4 pt-1">
          <div className="flex flex-wrap items-center gap-2">
            <SourceBadge item={item} />
            {item.published_at ? (
              <span className="text-xs text-ink-muted">{timeAgo(item.published_at)}</span>
            ) : null}
          </div>

          <h2 className="text-headline-lg font-bold text-ink leading-snug">{item.title}</h2>

          {item.image_url && !textOnly ? (
            <div className="relative h-56 w-full overflow-hidden rounded-xl bg-container">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.image_url} alt={item.title} className="h-full w-full object-cover" />
            </div>
          ) : null}

          {item.excerpt ? (
            <div className="prose prose-sm max-w-none text-body-md text-ink leading-relaxed">
              <Markdown source={item.excerpt} />
            </div>
          ) : null}

          {item.tags?.length ? (
            <div className="flex flex-wrap gap-1.5 pt-2">
              {item.tags.map((tag) => (
                <Tag key={tag}>{tag}</Tag>
              ))}
            </div>
          ) : null}

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-line pt-4">
            <div className="flex items-center gap-4 text-body-sm text-ink-muted">
              {item.score !== null ? (
                <span className="flex items-center gap-1 font-medium text-ink">
                  <ThumbsUp className="size-4 text-primary" aria-hidden />
                  {formatCount(item.score)} votes
                </span>
              ) : null}
              {item.comment_count !== null ? (
                <span className="flex items-center gap-1">
                  <MessageSquare className="size-4" aria-hidden />
                  {formatCount(item.comment_count)} commentaires
                </span>
              ) : null}
            </div>

            <div className="flex w-full sm:w-auto items-center gap-2">
              <Button
                variant="primary"
                onClick={() => window.open(item.url, '_blank', 'noopener,noreferrer')}
                className="w-full sm:w-auto"
              >
                <Globe className="size-4" aria-hidden />
                Consulter l’article à la source
              </Button>
            </div>
          </div>
        </div>
      </Dialog>
    </>
  );
}
