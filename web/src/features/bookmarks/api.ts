'use client';

import type { Schemas } from '@afridev/api-client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api, unwrap } from '@/shared/api';
import { useInfiniteList } from '@/shared/query';
import { useSession } from '@/shared/session';

export type Collection = Schemas['CollectionOutput'];
export type BookmarkItem = Schemas['ItemOutput'];
export type TargetType = Schemas['BookmarkTargetTypeEnum'];
export interface BookmarkTarget {
  type: TargetType;
  id: string;
}

export const bookmarkKeys = {
  all: ['bookmarks'] as const,
  collections: ['bookmarks', 'collections'] as const,
  saved: ['bookmarks', 'saved'] as const,
  items: (collectionId: string) => ['bookmarks', 'items', collectionId] as const,
};

export function useCollections() {
  const { isAuthenticated } = useSession();
  return useQuery({
    queryKey: bookmarkKeys.collections,
    queryFn: () => unwrap(api.GET('/api/bookmarks/collections/')),
    enabled: isAuthenticated,
  });
}

/** {target_id: [collection_id…]} : état de tous les boutons marque-page en une requête. */
export function useSavedMap() {
  const { isAuthenticated } = useSession();
  return useQuery({
    queryKey: bookmarkKeys.saved,
    queryFn: () => unwrap(api.GET('/api/bookmarks/saved/')),
    enabled: isAuthenticated,
    staleTime: 60_000,
    select: (rows) => new Map(rows.map((row) => [row.target_id, row.collection_ids])),
  });
}

export function useCollectionItems(collectionId: string | null) {
  return useInfiniteList(
    bookmarkKeys.items(collectionId ?? ''),
    (cursor) =>
      unwrap(
        api.GET('/api/bookmarks/collections/{collection_id}/items/', {
          params: { path: { collection_id: collectionId! }, query: { cursor } },
        }),
      ),
    { enabled: Boolean(collectionId) },
  );
}

export function useCollectionActions() {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: bookmarkKeys.all });
  const create = useMutation({
    mutationFn: (body: Schemas['CollectionInputRequest']) => unwrap(api.POST('/api/bookmarks/collections/', { body })),
    onSuccess: refresh,
  });
  const update = useMutation({
    mutationFn: ({ id, ...body }: Schemas['PatchedCollectionUpdateRequest'] & { id: string }) =>
      unwrap(api.PATCH('/api/bookmarks/collections/{collection_id}/', { params: { path: { collection_id: id } }, body })),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: (id: string) =>
      unwrap(api.DELETE('/api/bookmarks/collections/{collection_id}/', { params: { path: { collection_id: id } } })),
    onSuccess: refresh,
  });
  return { create, update, remove };
}

/** Ajoute ou retire un contenu d'une collection (cases de « Enregistrer dans… »). */
export function useToggleInCollection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ collectionId, target, saved }: { collectionId: string; target: BookmarkTarget; saved: boolean }) => {
      const path = { collection_id: collectionId };
      return saved
        ? unwrap(
            api.POST('/api/bookmarks/collections/{collection_id}/items/', {
              params: { path },
              body: { target_type: target.type, target_id: target.id },
            }),
          )
        : unwrap(
            api.DELETE('/api/bookmarks/collections/{collection_id}/items/', {
              params: { path, query: { target_type: target.type, target_id: target.id } },
            }),
          );
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: bookmarkKeys.all }),
  });
}

export function useRemoveItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) => unwrap(api.DELETE('/api/bookmarks/items/{item_id}/', { params: { path: { item_id: itemId } } })),
    onSettled: () => queryClient.invalidateQueries({ queryKey: bookmarkKeys.all }),
  });
}

export function useQuickSave() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (target: BookmarkTarget) =>
      unwrap(api.POST('/api/bookmarks/quick-save/', { body: { target_type: target.type, target_id: target.id } })),
    onSettled: () => queryClient.invalidateQueries({ queryKey: bookmarkKeys.all }),
  });
}
