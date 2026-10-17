'use client';

import type { Schemas } from '@afridev/api-client';
import { type InfiniteData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api, unwrap } from '@/shared/api';
import { type Page, useInfiniteList } from '@/shared/query';
import { useSession } from '@/shared/session';

export type Conversation = Schemas['Conversation'];
export type Message = Schemas['Message'];

// Messages privés : jamais gardés dans la copie locale du navigateur.
const PRIVATE = { persist: false } as const;

export const messageKeys = {
  all: ['messages'] as const,
  inbox: ['messages', 'inbox'] as const,
  unread: ['messages', 'unread'] as const,
  conversation: (id: string) => ['messages', 'conversation', id] as const,
  thread: (id: string) => ['messages', 'thread', id] as const,
};

/** Pastille de la barre latérale : conversations avec des messages non lus. */
export function useUnreadMessages() {
  const { isAuthenticated } = useSession();
  return useQuery({
    queryKey: messageKeys.unread,
    queryFn: () => unwrap(api.GET('/api/messages/unread/')),
    enabled: isAuthenticated,
    refetchInterval: 30_000,
    select: (data) => data.unread,
    meta: PRIVATE,
  });
}

export function useInbox() {
  const query = useInfiniteList(messageKeys.inbox, (cursor) =>
    unwrap(api.GET('/api/messages/conversations/', { params: { query: { cursor } } })),
    PRIVATE,
  );
  return query;
}

export function useConversation(id: string | null) {
  return useQuery({
    queryKey: messageKeys.conversation(id ?? ''),
    queryFn: () => unwrap(api.GET('/api/messages/conversations/{conversation_id}/', { params: { path: { conversation_id: id! } } })),
    enabled: Boolean(id),
    refetchInterval: 15_000,
    meta: PRIVATE,
  });
}

/** Fil d'une conversation, le plus récent en premier ; rafraîchi toutes les 4 s quand il est ouvert. */
export function useThread(id: string | null) {
  return useInfiniteList(
    messageKeys.thread(id ?? ''),
    (cursor) =>
      unwrap(api.GET('/api/messages/conversations/{conversation_id}/messages/', { params: { path: { conversation_id: id! }, query: { cursor } } })),
    { enabled: Boolean(id), refetchInterval: 4_000, ...PRIVATE },
  );
}

export function useOpenConversation() {
  return useMutation({
    mutationFn: (username: string) => unwrap(api.POST('/api/messages/conversations/', { body: { username } })),
  });
}

export function useSendMessage(conversationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { body?: string; media_id?: string }) =>
      unwrap(
        api.POST('/api/messages/conversations/{conversation_id}/messages/', {
          params: { path: { conversation_id: conversationId } },
          body: { body: input.body ?? '', media_id: input.media_id ?? null },
        }),
      ),
    onSuccess: (message) => {
      // Le message apparaît aussitôt en bas du fil, sans attendre le prochain rafraîchissement.
      queryClient.setQueryData<InfiniteData<Page<Message>>>(messageKeys.thread(conversationId), (data) =>
        data
          ? { ...data, pages: data.pages.map((page, index) => (index === 0 ? { ...page, results: [message, ...page.results] } : page)) }
          : data,
      );
      void queryClient.invalidateQueries({ queryKey: messageKeys.inbox });
    },
  });
}

export function useMarkConversationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (conversationId: string) =>
      unwrap(api.POST('/api/messages/conversations/{conversation_id}/read/', { params: { path: { conversation_id: conversationId } } })),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: messageKeys.unread });
      void queryClient.invalidateQueries({ queryKey: messageKeys.inbox });
    },
  });
}
