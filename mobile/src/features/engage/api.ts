import { type InfiniteData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Share } from 'react-native';

import type { HomeItem } from '@/features/feed/api';
import { api, PUBLIC_WEB_URL, type Schemas, unwrap } from '@/shared/api';
import type { Page } from '@/shared/query';
import { useSession } from '@/shared/session';

export type SaveType = Schemas['BookmarkTargetTypeEnum'];
export type ReportType = Schemas['TargetTypeEnum'];
export type ReportReason = Schemas['ReasonEnum'];
export type ReactType = 'question' | 'snippet' | 'project';
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
  const saved = useSaved();
  return Boolean(saved.data?.some((row) => row.target_type === type && row.target_id === id));
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
          : [...rows, { target_type: type, target_id: id, collection_ids: [] }],
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
    },
  });
}

/** Lien public du contenu (le site affiche un aperçu pour ceux qui n'ont pas l'appli). */
export function shareContent(title: string, path: string) {
  void Share.share({ message: `${title} — ${PUBLIC_WEB_URL}${path}` });
}
