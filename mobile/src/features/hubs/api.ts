import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api, apiFetch, type Schemas, unwrap } from '@/shared/api';
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

export type NewHub = Schemas['HubInputRequest'];

/** Création d'un hub : le créateur en devient modérateur. */
export function useCreateHub() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: NewHub) => unwrap(api.POST('/api/hubs/', { body })),
    onSuccess: (hub) => {
      queryClient.setQueryData(hubKeys.detail(hub.slug), hub);
      void queryClient.invalidateQueries({ queryKey: ['hubs', 'list'] });
    },
  });
}

/** Modification par les modérateurs du hub (ou le staff). */
export function useUpdateHub(slug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: Schemas['PatchedHubUpdateRequest']) => unwrap(api.PATCH('/api/hubs/{slug}/', { params: { path: { slug } }, body })),
    onSuccess: (hub) => {
      queryClient.setQueryData(hubKeys.detail(hub.slug), hub);
      void queryClient.invalidateQueries({ queryKey: ['hubs', 'list'] });
    },
  });
}

/** Suppression par le créateur du hub (ou le staff). */
export function useDeleteHub() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (slug: string) => unwrap(api.DELETE('/api/hubs/{slug}/', { params: { path: { slug } } })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: hubKeys.all }),
  });
}

export type HubMember = Schemas['HubMember'];
export type HubBan = Schemas['HubBan'];

/** Membres du hub (créateur, modérateurs et staff seulement). */
export function useHubMembers(slug: string, q: string) {
  return useInfiniteList(['hubs', 'members', slug, q], (cursor) =>
    unwrap(api.GET('/api/hubs/{slug}/members/', { params: { path: { slug }, query: { cursor, q: q || undefined } } })),
  );
}

export function useHubBans(slug: string) {
  return useInfiniteList(['hubs', 'bans', slug], (cursor) =>
    unwrap(api.GET('/api/hubs/{slug}/bans/', { params: { path: { slug }, query: { cursor } } })),
  );
}

/** Actions de modération sur un membre ; la fiche, les membres et les exclus sont rechargés. */
export function useMemberActions(slug: string) {
  const queryClient = useQueryClient();
  const refresh = () => void queryClient.invalidateQueries({ queryKey: hubKeys.all });
  const remove = useMutation({
    mutationFn: ({ username, ban = false }: { username: string; ban?: boolean }) =>
      unwrap(api.POST('/api/hubs/{slug}/members/{username}/remove/', { params: { path: { slug, username } }, body: { ban, reason: '' } })),
    onSuccess: refresh,
  });
  const promote = useMutation({
    mutationFn: (username: string) => unwrap(api.POST('/api/hubs/{slug}/moderators/', { params: { path: { slug } }, body: { username } })),
    onSuccess: refresh,
  });
  const demote = useMutation({
    // DELETE avec corps : absent du schéma OpenAPI, d'où l'appel direct (erreurs vérifiées).
    mutationFn: async (username: string) => {
      const response = await apiFetch(`/api/hubs/${encodeURIComponent(slug)}/moderators/`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error?.message ?? body?.detail ?? 'Révocation impossible.');
      }
    },
    onSuccess: refresh,
  });
  const lift = useMutation({
    mutationFn: (username: string) => unwrap(api.POST('/api/hubs/{slug}/bans/{username}/lift/', { params: { path: { slug, username } } })),
    onSuccess: refresh,
  });
  return { remove, promote, demote, lift };
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
