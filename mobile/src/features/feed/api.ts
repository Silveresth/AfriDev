import { type InfiniteData, type QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api, type Schemas, unwrap } from '@/shared/api';
import type { Key } from '@/shared/i18n';
import { type Page, useInfiniteList } from '@/shared/query';

export type Post = Schemas['PostOutput'];
export type Media = Schemas['MediaOutput'];
export type Comment = Schemas['CommentOutput'];
/** Tri du fil : populaires (défaut), nouveaux, mieux notés. */
export type FeedSort = 'hot' | 'new' | 'top';

export const SORTS: { value: FeedSort; label: Key }[] = [
  { value: 'hot', label: 'feed.sort_hot' },
  { value: 'new', label: 'feed.sort_new' },
  { value: 'top', label: 'feed.sort_top' },
];

export interface FeedFilters {
  sort?: FeedSort;
  hub?: string;
  author?: string;
}

export const feedKeys = {
  all: ['feed'] as const,
  list: (filters: FeedFilters) => ['feed', 'list', filters] as const,
  detail: (id: string) => ['feed', 'post', id] as const,
  comments: (id: string) => ['feed', 'post', id, 'comments'] as const,
};

export function useFeed(filters: FeedFilters = {}) {
  return useInfiniteList(feedKeys.list(filters), (cursor) =>
    unwrap(api.GET('/api/feed/', { params: { query: { cursor, ...filters } } })),
  );
}

export function usePost(id: string) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: feedKeys.detail(id),
    queryFn: () => unwrap(api.GET('/api/feed/{post_id}/', { params: { path: { post_id: id } } })),
    // Affichage immédiat depuis la liste déjà chargée, rafraîchi ensuite.
    placeholderData: () => findInLists(queryClient, id),
  });
}

function findInLists(queryClient: QueryClient, id: string): Post | undefined {
  for (const [, data] of queryClient.getQueriesData<InfiniteData<Page<Post>>>({ queryKey: ['feed', 'list'] })) {
    const found = data?.pages.flatMap((page) => page.results).find((post) => post.id === id);
    if (found) return found;
  }
  return undefined;
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
}

/** Vote ↑ (1), ↓ (-1) ou retrait (0) : affiché tout de suite, corrigé par la réponse. */
export function useScoreVote(post: Post) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (value: -1 | 0 | 1) =>
      unwrap(api.POST('/api/feed/{post_id}/score/', { params: { path: { post_id: post.id } }, body: { value } })),
    onMutate: (value) => {
      const previous = post.viewer?.post_vote ?? 0;
      replacePost(queryClient, {
        ...post,
        score: post.score - previous + value,
        viewer: { post_vote: value, liked: value === 1, vote: post.viewer?.vote ?? null },
      });
    },
    onSuccess: (updated) => replacePost(queryClient, updated),
    onError: () => replacePost(queryClient, post),
  });
}

export function usePollVote(post: Post) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (option: number) =>
      unwrap(api.POST('/api/feed/{post_id}/vote/', { params: { path: { post_id: post.id } }, body: { option } })),
    onSuccess: (updated) => replacePost(queryClient, updated),
  });
}

export interface NewPost {
  title: string;
  body: string;
  tags: string[];
  poll_options?: string[];
  hub_id?: string | null;
}

export function useCreatePost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: NewPost) =>
      unwrap(
        api.POST('/api/feed/', {
          body: {
            kind: input.poll_options?.length ? 'poll' : 'text',
            title: input.title,
            body: input.body,
            tags: input.tags,
            poll_options: input.poll_options ?? [],
            hub_id: input.hub_id ?? null,
          },
        }),
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['feed', 'list'] }),
  });
}

export function useDeletePost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => unwrap(api.DELETE('/api/feed/{post_id}/', { params: { path: { post_id: id } } })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: feedKeys.all }),
  });
}

// ── Commentaires ──

export function useComments(postId: string) {
  return useInfiniteList(feedKeys.comments(postId), (cursor) =>
    unwrap(api.GET('/api/discussions/posts/{post_id}/comments/', { params: { path: { post_id: postId }, query: { cursor } } })),
  );
}

export function useSendComment(postId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ body, parentId }: { body: string; parentId?: string | null }) =>
      unwrap(
        api.POST('/api/discussions/posts/{post_id}/comments/', {
          params: { path: { post_id: postId } },
          body: { body, parent_id: parentId ?? null },
        }),
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: feedKeys.comments(postId) });
      void queryClient.invalidateQueries({ queryKey: feedKeys.detail(postId) });
    },
  });
}

/** Tags saisis « django, wave api » -> ["django", "wave-api"] (5 maximum). */
export function parseTags(raw: string): string[] {
  return raw
    .split(/[,#\n]/)
    .map((tag) => tag.trim().toLowerCase().replace(/\s+/g, '-'))
    .filter(Boolean)
    .slice(0, 5);
}

/** Le champ `media` de l'API n'est pas typé : on ne garde que les images prêtes. */
export function imageOf(post: Post): Media | null {
  const media = post.media as Media | null | undefined;
  return media && media.kind === 'image' && media.status === 'ready' ? media : null;
}
