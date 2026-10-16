'use client';

import { Globe, Radio, Search } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

import { PageHeader, Toolbar, TwoColumns } from '@/shared/layout';
import { CardSkeleton, EmptyState, ErrorNotice, Segmented } from '@/shared/ui';

import { type NewsFilter, useTechNews } from '../api';
import { NewsCard } from './NewsCard';

const FILTERS: Array<{ value: NewsFilter; label: string }> = [
  { value: 'all', label: 'Toutes les sources' },
  { value: 'hackernews', label: 'Hacker News' },
  { value: 'devto', label: 'DEV.to' },
  { value: 'rss', label: 'Médias tech' },
  { value: 'fr', label: 'En français' },
];

/** /news : toute l'actualité tech (Hacker News, DEV.to, médias) avec filtres et recherche. */
export function NewsScreen({ aside }: { aside?: React.ReactNode }) {
  const params = useSearchParams();
  const router = useRouter();
  const filter = (params.get('source') as NewsFilter | null) ?? 'all';
  const [query, setQuery] = useState('');
  const news = useTechNews(filter, query);

  return (
    <TwoColumns aside={aside}>
      <PageHeader
        className="mb-2"
        icon={<Radio aria-hidden />}
        title="Actu tech"
        description="La veille du jour : Hacker News, DEV.to et les médias tech, mise à jour toutes les 10 minutes."
      />
      <Toolbar>
        <Segmented<NewsFilter>
          value={filter}
          onChange={(value) => router.replace(value === 'all' ? '/news' : `/news?source=${value}`, { scroll: false })}
          options={FILTERS}
        />
        <div className="relative ml-auto w-full max-w-xs">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Rechercher dans l'actu…"
            aria-label="Rechercher dans l'actualité tech"
            className="h-10 w-full rounded-full border border-line bg-card pr-4 pl-9 text-body-sm text-ink placeholder:text-ink-muted focus:border-primary focus:outline-hidden"
          />
        </div>
      </Toolbar>

      {news.isPending ? (
        <div className="space-y-3">
          <CardSkeleton lines={3} />
          <CardSkeleton lines={3} />
          <CardSkeleton lines={3} />
        </div>
      ) : news.isError && !news.data ? (
        <ErrorNotice message="Impossible de charger l'actualité pour le moment. Réessayez dans quelques minutes." />
      ) : !news.data?.length ? (
        <EmptyState icon={<Globe className="size-7" aria-hidden />} title="Aucun article trouvé">
          {query ? 'Aucun résultat ne correspond à votre recherche.' : 'Les flux se synchronisent régulièrement.'}
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {news.data.map((item) => (
            <li key={item.id}>
              <NewsCard item={item} />
            </li>
          ))}
        </ul>
      )}
    </TwoColumns>
  );
}
