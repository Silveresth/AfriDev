'use client';

import { type InfiniteData, type QueryKey, useMutation, useQueryClient } from '@tanstack/react-query';

import { api, unwrap } from '@/shared/api';

/** Commentaire de post, de projet / offre ou de snippet (mêmes types que les signalements). */
export type CommentTarget = 'comment' | 'target_comment' | 'snippet_comment';

export interface Votable {
  id: string;
  score?: number;
  viewer_vote?: number;
}

type Pages = InfiniteData<{ results: Votable[] }>;

/** Remplace score et vote du commentaire dans la liste paginée qui l'affiche. */
function patch(queryClient: ReturnType<typeof useQueryClient>, listKey: QueryKey, id: string, values: { score: number; viewer_vote: number }) {
  queryClient.setQueriesData<Pages>({ queryKey: listKey }, (data) =>
    data?.pages
      ? { ...data, pages: data.pages.map((page) => ({ ...page, results: page.results.map((row) => (row.id === id ? { ...row, ...values } : row)) })) }
      : data,
  );
}

/**
 * Pouce levé / baissé sur un commentaire, affiché tout de suite. Touchers rapprochés : seule la
 * réponse du dernier vote s'applique.
 */
export function useCommentVote(type: CommentTarget, comment: Votable, listKey: QueryKey) {
  const queryClient = useQueryClient();
  const mutationKey = ['vote', type, comment.id];
  const isLatest = () => queryClient.isMutating({ mutationKey }) <= 1;
  const before = { score: comment.score ?? 0, viewer_vote: comment.viewer_vote ?? 0 };
  return useMutation({
    mutationKey,
    mutationFn: (value: -1 | 0 | 1) =>
      unwrap(api.POST('/api/reactions/{target_type}/{target_id}/', { params: { path: { target_type: type, target_id: comment.id } }, body: { value } })),
    onMutate: (value) => patch(queryClient, listKey, comment.id, { viewer_vote: value, score: before.score - before.viewer_vote + value }),
    onSuccess: (summary) => {
      if (isLatest()) patch(queryClient, listKey, comment.id, { score: summary.score, viewer_vote: summary.viewer_vote });
    },
    onError: () => {
      if (isLatest()) patch(queryClient, listKey, comment.id, before);
    },
  });
}
