import { useQuery } from '@tanstack/react-query';

import { api, type Schemas, unwrap } from '@/shared/api';
import type { Key } from '@/shared/i18n';

export type NewsItem = Schemas['NewsItem'];

/** Filtres de l'écran : « fr » = médias francophones (Numerama, Frandroid). */
export type NewsFilter = 'all' | 'hackernews' | 'devto' | 'rss' | 'fr';

export const NEWS_FILTERS: { value: NewsFilter; label: Key | string }[] = [
  { value: 'all', label: 'news.all' },
  { value: 'hackernews', label: 'Hacker News' },
  { value: 'devto', label: 'DEV' },
  { value: 'rss', label: 'news.media' },
  { value: 'fr', label: 'news.french' },
];

export function useTechNews(filter: NewsFilter, q: string) {
  const query = filter === 'fr' ? { source: 'rss' as const, lang: 'fr' as const } : { source: filter };
  return useQuery({
    queryKey: ['news', filter, q],
    queryFn: () => unwrap(api.GET('/api/feed/news/', { params: { query: { ...query, q: q || undefined } } })),
    // Le serveur rafraîchit ses sources toutes les 10 min : inutile de redemander plus souvent.
    staleTime: 5 * 60_000,
  });
}
