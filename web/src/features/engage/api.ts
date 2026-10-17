'use client';

import type { Schemas } from '@afridev/api-client';
import { type InfiniteData, type QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api, unwrap } from '@/shared/api';
import { type Page, useInfiniteList } from '@/shared/query';

type HomeItem = Schemas['HomeItem'];
export type HomeStats = NonNullable<HomeItem['stats']>;
export type ReactType = 'question' | 'snippet' | 'project' | 'job';
/** Contenus dont les commentaires vivent dans /api/discussions/targets/. */
export type TargetType = 'project' | 'job';
export type TargetComment = Schemas['TargetCommentOutput'];

const targetKeys = {
  comments: (type: TargetType, id: string) => ['target-comments', type, id] as const,
  reaction: (type: ReactType, id: string) => ['reactions', type, id] as const,
};

/** Commentaires d'un projet ou d'une offre, du plus ancien au plus récent. */
export function useTargetComments(type: TargetType, id: string) {
  return useInfiniteList(targetKeys.comments(type, id), (cursor) =>
    unwrap(
      api.GET('/api/discussions/targets/{target_type}/{target_id}/comments/', {
        params: { path: { target_type: type, target_id: id }, query: { cursor } },
      }),
    ),
  );
}

export function useTargetCommentActions(type: TargetType, id: string) {
  const queryClient = useQueryClient();
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: targetKeys.comments(type, id) });
    void queryClient.invalidateQueries({ queryKey: ['feed', 'home'] });
  };
  const send = useMutation({
    mutationFn: (input: { body: string; parent_id?: string | null }) =>
      unwrap(
        api.POST('/api/discussions/targets/{target_type}/{target_id}/comments/', {
          params: { path: { target_type: type, target_id: id } },
          body: { body: input.body, parent_id: input.parent_id ?? null },
        }),
      ),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: (commentId: string) =>
      unwrap(api.DELETE('/api/discussions/target-comments/{comment_id}/', { params: { path: { comment_id: commentId } } })),
    onSuccess: refresh,
  });
  return { send, remove };
}

/** Score et vote du visiteur sur une page détail (projet, offre…), vote affiché tout de suite. */
export function useReaction(type: ReactType, id: string) {
  const queryClient = useQueryClient();
  const key = targetKeys.reaction(type, id);
  const summary = useQuery({
    queryKey: key,
    queryFn: () => unwrap(api.GET('/api/reactions/{target_type}/{target_id}/', { params: { path: { target_type: type, target_id: id } } })),
  });
  const vote = useMutation({
    mutationFn: (value: -1 | 0 | 1) =>
      unwrap(api.POST('/api/reactions/{target_type}/{target_id}/', { params: { path: { target_type: type, target_id: id } }, body: { value } })),
    onMutate: (value) => {
      const previous = queryClient.getQueryData<Schemas['ReactionSummary']>(key);
      if (previous) queryClient.setQueryData(key, { ...previous, viewer_vote: value, score: previous.score - previous.viewer_vote + value });
      return { previous };
    },
    onError: (_error, _value, context) => queryClient.setQueryData(key, context?.previous),
    onSuccess: (data) => {
      queryClient.setQueryData(key, data);
      patchHomeStats(queryClient, id, { score: data.score, viewer_vote: data.viewer_vote });
    },
  });
  return { summary, vote };
}

/** Met à jour les compteurs d'une carte du fil d'accueil, partout où elle est affichée. */
function patchHomeStats(queryClient: QueryClient, id: string, stats: Partial<HomeStats>) {
  queryClient.setQueriesData<InfiniteData<Page<HomeItem>>>({ queryKey: ['feed', 'home'] }, (data) =>
    data
      ? {
          ...data,
          pages: data.pages.map((page) => ({
            ...page,
            results: page.results.map((item) => (item.id === id && item.stats ? { ...item, stats: { ...item.stats, ...stats } } : item)),
          })),
        }
      : data,
  );
}

/** Pouce levé / baissé sur une question, un snippet ou un projet : affiché tout de suite. */
export function useCardVote(type: ReactType, id: string, stats: HomeStats) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (value: -1 | 0 | 1) =>
      unwrap(api.POST('/api/reactions/{target_type}/{target_id}/', { params: { path: { target_type: type, target_id: id } }, body: { value } })),
    onMutate: (value) => patchHomeStats(queryClient, id, { viewer_vote: value, score: stats.score - stats.viewer_vote + value }),
    onSuccess: (summary) => patchHomeStats(queryClient, id, { score: summary.score, viewer_vote: summary.viewer_vote }),
    onError: () => patchHomeStats(queryClient, id, { score: stats.score, viewer_vote: stats.viewer_vote }),
  });
}

/** Suppression depuis le fil (auteur ou staff) : la carte disparaît de l'accueil. */
export function useDeleteCard() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ type, id }: { type: ReactType; id: string }) => {
      if (type === 'question') await unwrap(api.DELETE('/api/qa/questions/{question_id}/', { params: { path: { question_id: id } } }));
      else if (type === 'snippet') await unwrap(api.DELETE('/api/snippets/public/{snippet_id}/', { params: { path: { snippet_id: id } } }));
      else if (type === 'job') await unwrap(api.DELETE('/api/job-board/{job_id}/', { params: { path: { job_id: id } } }));
      else await unwrap(api.DELETE('/api/projects/{project_id}/', { params: { path: { project_id: id } } }));
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['jobs'] });
      void queryClient.invalidateQueries({ queryKey: ['feed'] });
      void queryClient.invalidateQueries({ queryKey: ['qa'] });
      void queryClient.invalidateQueries({ queryKey: ['snippets'] });
      void queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}

/** Partage natif si disponible, sinon copie du lien. Renvoie true si le lien a été copié. */
export async function shareLink(path: string, title: string): Promise<boolean> {
  const url = `${window.location.origin}${path}`;
  try {
    if (navigator.share) {
      await navigator.share({ url, title });
      return false;
    }
    await navigator.clipboard.writeText(url);
    return true;
  } catch {
    return false;
  }
}
