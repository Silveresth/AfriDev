'use client';

import type { Schemas } from '@afridev/api-client';
import { type InfiniteData, type QueryClient, useMutation, useQueryClient } from '@tanstack/react-query';

import { api, unwrap } from '@/shared/api';
import type { Page } from '@/shared/query';

type HomeItem = Schemas['HomeItem'];
export type HomeStats = NonNullable<HomeItem['stats']>;
export type ReactType = 'question' | 'snippet' | 'project';

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
      else await unwrap(api.DELETE('/api/projects/{project_id}/', { params: { path: { project_id: id } } }));
    },
    onSuccess: () => {
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
