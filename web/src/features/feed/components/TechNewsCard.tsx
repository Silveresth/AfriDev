'use client';

import { ArrowRight, Radio } from 'lucide-react';
import Link from 'next/link';

import { timeAgo } from '@/shared/lib';
import { SideCard, Skeleton } from '@/shared/ui';

import { useTechNews } from '../api';

const SOURCE_DOT: Record<string, string> = { hackernews: 'bg-[#FF6600]', devto: 'bg-ink' };

/**
 * Colonne de droite de l'accueil : les derniers titres de l'actu tech (même cache que /news,
 * aucune requête supplémentaire vers les sources), avec le lien vers la page dédiée.
 */
export function TechNewsCard({ limit = 6 }: { limit?: number }) {
  const news = useTechNews('all');
  return (
    <SideCard
      title="Actu tech"
      icon={<Radio aria-hidden />}
      action={
        <Link href="/news" className="text-label-md font-semibold text-primary-ink hover:underline">
          Tout voir
        </Link>
      }
    >
      <div className="px-2 pb-2">
        {news.isPending ? (
          <div className="space-y-2 px-2 pb-2">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-10" />
            ))}
          </div>
        ) : !news.data?.length ? (
          <p className="px-2 pb-2 text-body-sm text-ink-muted">L&apos;actualité arrive dans quelques minutes.</p>
        ) : (
          <ul>
            {news.data.slice(0, limit).map((item) => (
              <li key={item.id}>
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex gap-2.5 rounded-lg px-2 py-2 transition-colors hover:bg-container-low"
                >
                  <span className={`mt-1.5 size-2 shrink-0 rounded-full ${SOURCE_DOT[item.source] ?? 'bg-tertiary'}`} aria-hidden />
                  <span className="min-w-0">
                    <span className="line-clamp-2 text-body-sm font-medium text-ink group-hover:text-primary-ink">{item.title}</span>
                    <span className="text-label-md text-ink-faint">
                      {item.source_name}
                      {item.published_at ? ` · ${timeAgo(item.published_at)}` : ''}
                    </span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        )}
        <Link
          href="/news"
          className="mt-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-body-sm font-medium text-ink-muted hover:bg-container-low hover:text-ink"
        >
          Toute l&apos;actualité tech <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>
    </SideCard>
  );
}
