'use client';

import type { Schemas } from '@afridev/api-client';
import { type InfiniteData, type QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api, unwrap } from '@/shared/api';
import { sendOrQueue } from '@/shared/offline';
import { type Page, useInfiniteList } from '@/shared/query';

export type Post = Schemas['PostOutput'];
export type PostKind = Schemas['PostKindEnum'];
/** Tri du fil : populaires (défaut), nouveaux, mieux notés. */
export type FeedSort = 'hot' | 'new' | 'top';

export interface FeedFilters {
  kind?: PostKind;
  author?: string;
  tag?: string;
  /** Slug ou UUID du hub. */
  hub?: string;
  /** Seulement les posts portant une vidéo (onglet « Vidéos & Tutos ») ou une image. */
  media?: 'video' | 'image';
  sort?: FeedSort;
}

export const feedKeys = {
  all: ['feed'] as const,
  list: (filters: FeedFilters) => ['feed', 'list', filters] as const,
  detail: (id: string) => ['feed', 'post', id] as const,
};

export function useFeed(filters: FeedFilters = {}) {
  return useInfiniteList(feedKeys.list(filters), (cursor) =>
    unwrap(api.GET('/api/feed/', { params: { query: { cursor, ...filters } } })),
  );
}

export function usePost(id: string, initialData?: Post) {
  return useQuery({
    queryKey: feedKeys.detail(id),
    queryFn: () => unwrap(api.GET('/api/feed/{post_id}/', { params: { path: { post_id: id } } })),
    initialData,
  });
}

/** Remplace un post partout où il est affiché (listes et détail). */
function replacePost(queryClient: QueryClient, post: Post) {
  queryClient.setQueryData(feedKeys.detail(post.id), post);
  queryClient.setQueriesData<InfiniteData<Page<Post>>>({ queryKey: ['feed', 'list'] }, (data) =>
    data
      ? {
          ...data,
          pages: data.pages.map((page) => ({
            ...page,
            results: page.results.map((item) => (item.id === post.id ? post : item)),
          })),
        }
      : data,
  );
  // Fil d'accueil mixte : le post y est imbriqué dans un élément { type: 'post', post }.
  queryClient.setQueriesData<InfiniteData<Page<Schemas['HomeItem']>>>({ queryKey: ['feed', 'home'] }, (data) =>
    data
      ? {
          ...data,
          pages: data.pages.map((page) => ({
            ...page,
            results: page.results.map((item) => (item.type === 'post' && item.id === post.id ? { ...item, post } : item)),
          })),
        }
      : data,
  );
}

export interface NewPost {
  kind: PostKind;
  title: string;
  body: string;
  poll_options?: string[];
  media_id?: string | null;
  tags?: string[];
  hub_id?: string | null;
}

export function useCreatePost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: NewPost) => {
      const id = crypto.randomUUID();
      const body = { id, ...input, poll_options: input.poll_options ?? [], tags: input.tags ?? [] };
      // Un post avec média exige le réseau (le fichier doit être envoyé d'abord).
      if (input.media_id) {
        return unwrap(api.POST('/api/feed/', { body })).then((result) => ({ queued: false as const, result }));
      }
      return sendOrQueue(() => unwrap(api.POST('/api/feed/', { body })), {
        id,
        op: 'PUT',
        type: 'posts',
        data: {
          kind: input.kind,
          title: input.title,
          body: input.body,
          poll_options: body.poll_options,
          media_id: null,
          tags: body.tags,
          hub_id: input.hub_id ?? null,
        },
        label: `Post : ${(input.title || input.body).slice(0, 40)}`,
      });
    },
    onSuccess: (outcome) => {
      if (!outcome.queued) void queryClient.invalidateQueries({ queryKey: ['feed', 'list'] });
    },
  });
}

/** Vote ↑ (1), ↓ (-1) ou retrait (0) ; recliquer sur la même flèche retire le vote. */
export function useScoreVote(post: Post) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (value: -1 | 0 | 1) =>
      unwrap(api.POST('/api/feed/{post_id}/score/', { params: { path: { post_id: post.id } }, body: { value } })),
    onMutate: (value) => {
      // Affichage immédiat, corrigé par la réponse du serveur.
      const previous = post.viewer?.post_vote ?? 0;
      replacePost(queryClient, {
        ...post,
        score: (post.score ?? post.like_count ?? 0) - previous + value,
        viewer: {
          post_vote: value,
          liked: value === 1,
          vote: post.viewer?.vote ?? null,
          can_moderate: post.viewer?.can_moderate ?? false,
        },
      });
    },
    onSuccess: (updated) => replacePost(queryClient, updated),
    onError: () => replacePost(queryClient, post),
  });
}

export function useVote(post: Post) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (option: number) =>
      unwrap(api.POST('/api/feed/{post_id}/vote/', { params: { path: { post_id: post.id } }, body: { option } })),
    onSuccess: (updated) => replacePost(queryClient, updated),
  });
}

/** Modification par l'auteur (ou le staff) : le post est remplacé partout où il s'affiche. */
export function useUpdatePost(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { title: string; body: string; tags: string[] }) =>
      unwrap(api.PATCH('/api/feed/{post_id}/', { params: { path: { post_id: id } }, body })),
    onSuccess: (post) => replacePost(queryClient, post),
  });
}

export function useDeletePost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => unwrap(api.DELETE('/api/feed/{post_id}/', { params: { path: { post_id: id } } })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: feedKeys.all }),
  });
}

/** Épingler / détacher un post en tête de son hub (modérateurs du hub). */
export function usePinPost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, pinned }: { id: string; pinned: boolean }) =>
      unwrap(api.POST('/api/feed/{post_id}/pin/', { params: { path: { post_id: id } }, body: { pinned } })),
    onSuccess: (post) => {
      replacePost(queryClient, post);
      // L'ordre du fil du hub change (épinglés en tête) : recharge des listes.
      void queryClient.invalidateQueries({ queryKey: ['feed', 'list'] });
    },
  });
}

export type Community = Schemas['Community'];

/** Communautés = tags les plus actifs des 90 derniers jours (posts + questions). */
export function useCommunities(limit = 12) {
  return useQuery({
    queryKey: ['feed', 'communities', limit],
    queryFn: () => unwrap(api.GET('/api/feed/communities/', { params: { query: { limit } } })),
    staleTime: 10 * 60_000,
  });
}

export type HomeItem = Schemas['HomeItem'];
export type HomeFilter = 'all' | 'posts' | 'questions' | 'snippets' | 'projects' | 'jobs';
export type HomeScope = 'for_you' | 'following';

/** Fil d'accueil mixte (posts, questions, snippets, projets, offres) classé selon les préférences. */
export function useHomeFeed(filter: HomeFilter, scope: HomeScope, enabled = true) {
  return useInfiniteList(
    ['feed', 'home', filter, scope],
    (cursor) => unwrap(api.GET('/api/feed/home/', { params: { query: { cursor, filter, scope } } })),
    { enabled },
  );
}

export type NewsItem = Schemas['NewsItem'];
export type NewsFilter = 'all' | 'hackernews' | 'devto' | 'rss' | 'fr';

export function useTechNews(filter: NewsFilter = 'all', q = '') {
  const query = filter === 'fr' ? { source: 'rss' as const, lang: 'fr' as const } : { source: filter };
  return useQuery({
    queryKey: ['news', filter, q],
    queryFn: () => unwrap(api.GET('/api/feed/news/', { params: { query: { ...query, q: q || undefined } } })),
    staleTime: 5 * 60_000,
  });
}