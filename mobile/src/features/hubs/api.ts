import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api, type Schemas, unwrap } from '@/shared/api';
import type { Key } from '@/shared/i18n';
import { useInfiniteList } from '@/shared/query';

export type Hub = Schemas['HubOutput'];
export type HubSort = 'popular' | 'new' | 'mine';

export const HUB_SORTS: { value: HubSort; label: Key }[] = [
  { value: 'popular', label: 'feed.sort_hot' },
  { value: 'new', label: 'hubs.new' },
  { value: 'mine', label: 'hubs.mine' },
];

export const hubKeys = {
  all: ['hubs'] as const,
  list: (sort: HubSort, q: string) => ['hubs', 'list', sort, q] as const,
  detail: (slug: string) => ['hubs', 'detail', slug] as const,
};

export function useHubs(sort: HubSort, q = '', enabled = true) {
  const query = sort === 'mine' ? { mine: true } : { sort };
  return useInfiniteList(
    hubKeys.list(sort, q),
    (cursor) => unwrap(api.GET('/api/hubs/', { params: { query: { cursor, ...query, q: q || undefined } } })),
    { enabled },
  );
}

export function useHub(slug: string) {
  return useQuery({
    queryKey: hubKeys.detail(slug),
    queryFn: () => unwrap(api.GET('/api/hubs/{slug}/', { params: { path: { slug } } })),
    enabled: Boolean(slug),
  });
}

/** Rejoindre / quitter : la fiche et les listes sont mises à jour avec la réponse. */
export function useJoinHub(slug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (join: boolean) => {
      const options = { params: { path: { slug } } };
      return unwrap(join ? api.POST('/api/hubs/{slug}/join/', options) : api.DELETE('/api/hubs/{slug}/join/', options));
    },
    onSuccess: (fresh) => {
      queryClient.setQueryData(hubKeys.detail(fresh.slug), fresh);
      void queryClient.invalidateQueries({ queryKey: ['hubs', 'list'] });
    },
  });
}
