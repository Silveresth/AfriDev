'use client';

import type { Schemas } from '@afridev/api-client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api, unwrap } from '@/shared/api';
import { useInfiniteList } from '@/shared/query';
import { useSession } from '@/shared/session';

export type Hub = Schemas['HubOutput'];
export type HubInput = Schemas['HubInputRequest'];
export type HubSort = 'popular' | 'new';

export interface HubFilters {
  q?: string;
  country?: string;
  mine?: boolean;
  sort?: HubSort;
}

export const hubKeys = {
  all: ['hubs'] as const,
  list: (filters: HubFilters) => ['hubs', 'list', filters] as const,
  detail: (slug: string) => ['hubs', 'detail', slug] as const,
};

export function useHubs(filters: HubFilters = {}, options: { enabled?: boolean } = {}) {
  return useInfiniteList(
    hubKeys.list(filters),
    (cursor) => unwrap(api.GET('/api/hubs/', { params: { query: { cursor, ...filters } } })),
    options,
  );
}

/** Hubs dont je suis membre (menu latéral, sélecteur de hub du formulaire). */
export function useMyHubs() {
  const { isAuthenticated } = useSession();
  return useHubs({ mine: true }, { enabled: isAuthenticated });
}

export function useHub(slug: string, initialData?: Hub) {
  return useQuery({
    queryKey: hubKeys.detail(slug),
    queryFn: () => unwrap(api.GET('/api/hubs/{slug}/', { params: { path: { slug } } })),
    initialData,
    // La version rendue côté serveur est anonyme : on relit tout de suite l'état « membre ».
    initialDataUpdatedAt: 0,
    enabled: Boolean(slug),
  });
}

export function useCreateHub() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: HubInput) => unwrap(api.POST('/api/hubs/', { body })),
    onSuccess: (hub) => {
      queryClient.setQueryData(hubKeys.detail(hub.slug), hub);
      void queryClient.invalidateQueries({ queryKey: hubKeys.all });
    },
  });
}

/** Rejoindre / quitter : mise à jour immédiate de la carte, confirmée par la réponse. */
export function useJoinHub(hub: Pick<Hub, 'slug'>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (join: boolean) => {
      const options = { params: { path: { slug: hub.slug } } };
      return unwrap(join ? api.POST('/api/hubs/{slug}/join/', options) : api.DELETE('/api/hubs/{slug}/join/', options));
    },
    onSuccess: (fresh) => {
      queryClient.setQueryData(hubKeys.detail(fresh.slug), fresh);
      void queryClient.invalidateQueries({ queryKey: ['hubs', 'list'] });
    },
  });
}
