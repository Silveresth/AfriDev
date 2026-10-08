'use client';

import type { Schemas } from '@afridev/api-client';
import { type InfiniteData, type QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api, unwrap } from '@/shared/api';
import { type Page, useInfiniteList } from '@/shared/query';
import { useSession } from '@/shared/session';

export type Notification = Schemas['Notification'];

export const notificationKeys = {
  all: ['notifications'] as const,
  unread: ['notifications', 'unread'] as const,
  list: (unreadOnly: boolean) => ['notifications', 'list', unreadOnly] as const,
};

export function useUnreadCount() {
  const { isAuthenticated } = useSession();
  return useQuery({
    queryKey: notificationKeys.unread,
    queryFn: () => unwrap(api.GET('/api/notifications/unread-count/')),
    enabled: isAuthenticated,
    refetchInterval: 120_000,
    select: (data) => data.unread,
  });
}

export function useNotifications(unreadOnly: boolean) {
  return useInfiniteList(notificationKeys.list(unreadOnly), (cursor) =>
    unwrap(
      api.GET('/api/notifications/', {
        params: { query: { cursor, unread: unreadOnly || undefined } },
      }),
    ),
  );
}

/**
 * Applique tout de suite un changement aux listes en cache (toutes / non lues) et au compteur :
 * le panneau réagit sans attendre le serveur, puis on resynchronise.
 */
function patchCache(
  queryClient: QueryClient,
  update: (items: Notification[]) => Notification[],
  unreadDelta: (unread: number) => number,
) {
  queryClient.setQueriesData<InfiniteData<Page<Notification>>>({ queryKey: ['notifications', 'list'] }, (data) =>
    data ? { ...data, pages: data.pages.map((page) => ({ ...page, results: update(page.results) })) } : data,
  );
  queryClient.setQueryData<{ unread: number }>(notificationKeys.unread, (data) =>
    data ? { unread: Math.max(0, unreadDelta(data.unread)) } : data,
  );
}

function useOptimistic<V>(
  mutationFn: (variables: V) => Promise<unknown>,
  apply: (queryClient: QueryClient, variables: V) => void,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onMutate: async (variables: V) => {
      await queryClient.cancelQueries({ queryKey: notificationKeys.all });
      apply(queryClient, variables);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: notificationKeys.all }),
  });
}

const now = () => new Date().toISOString();

export function useMarkRead() {
  return useOptimistic(
    (notification: Notification) =>
      unwrap(
        api.POST('/api/notifications/{notification_id}/read/', {
          params: { path: { notification_id: notification.id } },
        }),
      ),
    (queryClient, target) =>
      patchCache(
        queryClient,
        (items) => items.map((item) => (item.id === target.id ? { ...item, read_at: item.read_at ?? now() } : item)),
        (unread) => (target.read_at ? unread : unread - 1),
      ),
  );
}

export function useMarkAllRead() {
  return useOptimistic(
    () => unwrap(api.POST('/api/notifications/read-all/')),
    (queryClient) =>
      patchCache(
        queryClient,
        (items) => items.map((item) => ({ ...item, read_at: item.read_at ?? now() })),
        () => 0,
      ),
  );
}

export function useDeleteNotification() {
  return useOptimistic(
    (notification: Notification) =>
      unwrap(
        api.DELETE('/api/notifications/{notification_id}/', {
          params: { path: { notification_id: notification.id } },
        }),
      ),
    (queryClient, target) =>
      patchCache(
        queryClient,
        (items) => items.filter((item) => item.id !== target.id),
        (unread) => (target.read_at ? unread : unread - 1),
      ),
  );
}

export function useClearNotifications() {
  return useOptimistic(
    () => unwrap(api.DELETE('/api/notifications/')),
    (queryClient) => patchCache(queryClient, () => [], () => 0),
  );
}

/** Lien de l'écran concerné, d'après data = {type, id}. */
export function notificationHref(notification: Notification): string | null {
  const data = (notification.data ?? {}) as { type?: string; id?: string };
  if (!data.id) return null;
  switch (data.type) {
    case 'post':
      return `/feed/${data.id}`;
    case 'question':
      return `/questions/${data.id}`;
    case 'snippet':
      return `/snippets/${data.id}`;
    case 'project':
      return `/projects/${data.id}`;
    case 'guide':
      return `/projects/guides/${data.id}`;
    case 'comment':
    case 'answer':
      return null;
    default:
      return null;
  }
}
