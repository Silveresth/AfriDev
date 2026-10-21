import { type InfiniteData, type QueryKey, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Share } from 'react-native';

import type { HomeItem } from '@/features/feed/api';
import { api, PUBLIC_WEB_URL, type Schemas, unwrap } from '@/shared/api';
import { type Page, useInfiniteList } from '@/shared/query';
import { useSession } from '@/shared/session';

export type SaveType = Schemas['BookmarkTargetTypeEnum'];
export type ReportType = Schemas['TargetTypeEnum'];
export type ReportReason = Schemas['ReasonEnum'];
export type ReactType = 'question' | 'snippet' | 'project' | 'job';
/** Projets et offres : commentaires dans /api/discussions/targets/. */
export type TargetType = 'project' | 'job';
export type TargetComment = Schemas['TargetCommentOutput'];

const targetKeys = {
  comments: (type: TargetType, id: string) => ['target-comments', type, id] as const,
  reaction: (type: ReactType, id: string) => ['reactions', type, id] as const,
};

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

/** Score et vote du visiteur sur un écran détail, vote affiché tout de suite. */
export function useReaction(type: ReactType, id: string) {
  const queryClient = useQueryClient();
  const key = targetKeys.reaction(type, id);
  const summary = useQuery({
    queryKey: key,
    queryFn: () => unwrap(api.GET('/api/reactions/{target_type}/{target_id}/', { params: { path: { target_type: type, target_id: id } } })),
  });
  const mutationKey = ['vote', type, id];
  const isLatest = () => queryClient.isMutating({ mutationKey }) <= 1;
  const vote = useMutation({
    mutationKey,
    mutationFn: (value: -1 | 0 | 1) =>
      unwrap(api.POST('/api/reactions/{target_type}/{target_id}/', { params: { path: { target_type: type, target_id: id } }, body: { value } })),
    onMutate: (value) => {
      const previous = queryClient.getQueryData<Schemas['ReactionSummary']>(key);
      if (previous) queryClient.setQueryData(key, { ...previous, viewer_vote: value, score: previous.score - previous.viewer_vote + value });
      return { previous };
    },
    onError: (_error, _value, context) => {
      if (isLatest()) queryClient.setQueryData(key, context?.previous);
    },
    onSuccess: (data) => {
      if (!isLatest()) return;
      queryClient.setQueryData(key, data);
      patchHomeStats(queryClient, id, { score: data.score, viewer_vote: data.viewer_vote });
    },
  });
  return { summary, vote };
}
type Saved = Schemas['SavedTarget'];

export const REPORT_REASONS: ReportReason[] = ['spam', 'abuse', 'scam', 'secret', 'off_topic', 'other'];

const SAVED_KEY = ['bookmarks', 'saved'] as const;

/** Tout ce que le membre a enregistré : une requête pour tous les boutons marque-page. */
export function useSaved() {
  const { isAuthenticated } = useSession();
  return useQuery({
    queryKey: SAVED_KEY,
    queryFn: () => unwrap(api.GET('/api/bookmarks/saved/')),
    enabled: isAuthenticated,
    staleTime: 60_000,
  });
}

export function useIsSaved(type: SaveType, id: string) {
  return useSavedIn(type, id).length > 0;
}

/** Collections contenant ce contenu (cases cochées de « Enregistrer dans… »). */
export function useSavedIn(type: SaveType, id: string): string[] {
  const saved = useSaved();
  return saved.data?.find((row) => row.target_type === type && row.target_id === id)?.collection_ids ?? [];
}

/** Enregistre dans la collection par défaut, ou retire de toutes les collections. */
export function useToggleSave() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ type, id }: { type: SaveType; id: string }) => {
      const rows = queryClient.getQueryData<Saved[]>(SAVED_KEY) ?? [];
      const current = rows.find((row) => row.target_type === type && row.target_id === id);
      if (!current) {
        await unwrap(api.POST('/api/bookmarks/quick-save/', { body: { target_type: type, target_id: id } }));
        return true;
      }
      await Promise.all(
        current.collection_ids.map((collection_id) =>
          unwrap(
            api.DELETE('/api/bookmarks/collections/{collection_id}/items/', {
              params: { path: { collection_id }, query: { target_type: type, target_id: id } },
            }),
          ),
        ),
      );
      return false;
    },
    onMutate: ({ type, id }) => {
      const previous = queryClient.getQueryData<Saved[]>(SAVED_KEY);
      const rows = previous ?? [];
      const exists = rows.some((row) => row.target_type === type && row.target_id === id);
      queryClient.setQueryData<Saved[]>(
        SAVED_KEY,
        exists
          ? rows.filter((row) => !(row.target_type === type && row.target_id === id))
          : // Collection encore inconnue (« Favoris » créée côté serveur) : le bouton est déjà rempli.
            [...rows, { target_type: type, target_id: id, collection_ids: ['pending'] }],
      );
      return { previous };
    },
    onError: (_error, _input, context) => queryClient.setQueryData(SAVED_KEY, context?.previous),
    onSettled: () => queryClient.invalidateQueries({ queryKey: SAVED_KEY }),
  });
}

export function useReport() {
  return useMutation({
    mutationFn: (input: { type: ReportType; id: string; reason: ReportReason }) =>
      unwrap(
        api.POST('/api/moderation/reports/', {
          body: { target_type: input.type, target_id: input.id, reason: input.reason, details: '' },
        }),
      ),
  });
}

/** Met à jour les compteurs d'une carte du fil d'accueil, partout où elle est affichée. */
function patchHomeStats(queryClient: ReturnType<typeof useQueryClient>, id: string, stats: Partial<NonNullable<HomeItem['stats']>>) {
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
export function useCardVote(type: ReactType, id: string, stats: NonNullable<HomeItem['stats']>) {
  const queryClient = useQueryClient();
  const mutationKey = ['vote', type, id];
  // Seule la réponse du dernier vote s'applique (touchers rapprochés).
  const isLatest = () => queryClient.isMutating({ mutationKey }) <= 1;
  return useMutation({
    mutationKey,
    mutationFn: (value: -1 | 0 | 1) =>
      unwrap(api.POST('/api/reactions/{target_type}/{target_id}/', { params: { path: { target_type: type, target_id: id } }, body: { value } })),
    onMutate: (value) => patchHomeStats(queryClient, id, { viewer_vote: value, score: stats.score - stats.viewer_vote + value }),
    onSuccess: (summary) => {
      if (isLatest()) patchHomeStats(queryClient, id, { score: summary.score, viewer_vote: summary.viewer_vote });
    },
    onError: () => {
      if (isLatest()) patchHomeStats(queryClient, id, { score: stats.score, viewer_vote: stats.viewer_vote });
    },
  });
}

/** Commentaire de post, de projet / offre ou de snippet (mêmes types que les signalements). */
export type CommentTarget = 'comment' | 'target_comment' | 'snippet_comment';

export interface Votable {
  id: string;
  score?: number;
  viewer_vote?: number;
}

/**
 * Pouce levé / baissé sur un commentaire, affiché tout de suite dans la liste `listKey`.
 * Touchers rapprochés : seule la réponse du dernier vote s'applique.
 */
export function useCommentVote(type: CommentTarget, comment: Votable, listKey: QueryKey) {
  const queryClient = useQueryClient();
  const mutationKey = ['vote', type, comment.id];
  const isLatest = () => queryClient.isMutating({ mutationKey }) <= 1;
  const before = { score: comment.score ?? 0, viewer_vote: comment.viewer_vote ?? 0 };
  const patch = (values: { score: number; viewer_vote: number }) =>
    queryClient.setQueriesData<InfiniteData<Page<Votable>>>({ queryKey: listKey }, (data) =>
      data?.pages
        ? {
            ...data,
            pages: data.pages.map((page) => ({
              ...page,
              results: page.results.map((row) => (row.id === comment.id ? { ...row, ...values } : row)),
            })),
          }
        : data,
    );
  return useMutation({
    mutationKey,
    mutationFn: (value: -1 | 0 | 1) =>
      unwrap(api.POST('/api/reactions/{target_type}/{target_id}/', { params: { path: { target_type: type, target_id: comment.id } }, body: { value } })),
    onMutate: (value) => patch({ viewer_vote: value, score: before.score - before.viewer_vote + value }),
    onSuccess: (summary) => {
      if (isLatest()) patch({ score: summary.score, viewer_vote: summary.viewer_vote });
    },
    onError: () => {
      if (isLatest()) patch(before);
    },
  });
}

export const targetCommentsKey = targetKeys.comments;

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
      void queryClient.invalidateQueries({ queryKey: ['projects'] });
      void queryClient.invalidateQueries({ queryKey: ['feed'] });
      void queryClient.invalidateQueries({ queryKey: ['qa'] });
      void queryClient.invalidateQueries({ queryKey: ['snippets'] });
    },
  });
}

/** Lien public du contenu (le site affiche un aperçu pour ceux qui n'ont pas l'appli). */
export function shareContent(title: string, path: string) {
  void Share.share({ message: `${title} — ${PUBLIC_WEB_URL}${path}` });
}
