import { type InfiniteData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api, type Schemas, unwrap } from '@/shared/api';
import { type Page, useInfiniteList } from '@/shared/query';
import { useSession } from '@/shared/session';

export type Conversation = Schemas['Conversation'];
export type Message = Schemas['Message'];

export const messageKeys = {
  inbox: ['messages', 'inbox'] as const,
  unread: ['messages', 'unread'] as const,
  conversation: (id: string) => ['messages', 'conversation', id] as const,
  thread: (id: string) => ['messages', 'thread', id] as const,
};

export function useUnreadMessages() {
  const { isAuthenticated } = useSession();
  return useQuery({
    queryKey: messageKeys.unread,
    queryFn: () => unwrap(api.GET('/api/messages/unread/')),
    enabled: isAuthenticated,
    refetchInterval: 30_000,
    select: (data) => data.unread,
  });
}

export function useInbox() {
  return useInfiniteList(messageKeys.inbox, (cursor) =>
    unwrap(api.GET('/api/messages/conversations/', { params: { query: { cursor } } })),
  );
}

export function useConversation(id: string) {
  return useQuery({
    queryKey: messageKeys.conversation(id),
    queryFn: () => unwrap(api.GET('/api/messages/conversations/{conversation_id}/', { params: { path: { conversation_id: id } } })),
    enabled: Boolean(id),
    refetchInterval: 15_000,
  });
}

/** Fil de la conversation, le plus récent en premier ; rafraîchi toutes les 4 s quand il est ouvert. */
export function useThread(id: string) {
  return useInfiniteList(
    messageKeys.thread(id),
    (cursor) =>
      unwrap(api.GET('/api/messages/conversations/{conversation_id}/messages/', { params: { path: { conversation_id: id }, query: { cursor } } })),
    { enabled: Boolean(id), refetchInterval: 4_000 },
  );
}

export function useOpenConversation() {
  return useMutation({
    mutationFn: (username: string) => unwrap(api.POST('/api/messages/conversations/', { body: { username } })),
  });
}

// Mêmes délais que le serveur (et que WhatsApp).
const EDIT_WINDOW_MS = 15 * 60 * 1000;
const REVOKE_WINDOW_MS = 2 * 24 * 3600 * 1000;

const age = (message: Message) => Date.now() - new Date(message.created_at).getTime();
export const canEdit = (message: Message, userId?: string) =>
  message.sender_id === userId && !message.revoked && age(message) < EDIT_WINDOW_MS;
export const canRevoke = (message: Message, userId?: string) =>
  message.sender_id === userId && !message.revoked && age(message) < REVOKE_WINDOW_MS;

type Thread = InfiniteData<Page<Message>>;

function patchThread(queryClient: ReturnType<typeof useQueryClient>, conversationId: string, change: (messages: Message[]) => Message[]) {
  queryClient.setQueryData<Thread>(messageKeys.thread(conversationId), (data) =>
    data ? { ...data, pages: data.pages.map((page) => ({ ...page, results: change(page.results) })) } : data,
  );
}

export function useSendMessage(conversationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { body?: string; media_id?: string; reply_to_id?: string | null }) =>
      unwrap(
        api.POST('/api/messages/conversations/{conversation_id}/messages/', {
          params: { path: { conversation_id: conversationId } },
          body: { body: input.body ?? '', media_id: input.media_id ?? null, reply_to_id: input.reply_to_id ?? null },
        }),
      ),
    onSuccess: (message) => {
      queryClient.setQueryData<Thread>(messageKeys.thread(conversationId), (data) =>
        data ? { ...data, pages: data.pages.map((page, index) => (index === 0 ? { ...page, results: [message, ...page.results] } : page)) } : data,
      );
      void queryClient.invalidateQueries({ queryKey: messageKeys.inbox });
    },
  });
}

export function useEditMessage(conversationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; body: string }) =>
      unwrap(
        api.PATCH('/api/messages/conversations/{conversation_id}/messages/{message_id}/', {
          params: { path: { conversation_id: conversationId, message_id: input.id } },
          body: { body: input.body },
        }),
      ),
    onSuccess: (message) => {
      patchThread(queryClient, conversationId, (messages) => messages.map((m) => (m.id === message.id ? message : m)));
      void queryClient.invalidateQueries({ queryKey: messageKeys.inbox });
    },
  });
}

/** Messages sélectionnés : supprimés pour moi, ou pour tout le monde (« Message supprimé »). */
export function useDeleteMessages(conversationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { ids: string[]; forEveryone: boolean }) =>
      unwrap(
        api.POST('/api/messages/conversations/{conversation_id}/messages/delete/', {
          params: { path: { conversation_id: conversationId } },
          body: { ids: input.ids, for_everyone: input.forEveryone },
        }),
      ),
    onSuccess: (_result, { ids, forEveryone }) => {
      const selected = new Set(ids);
      patchThread(queryClient, conversationId, (messages) =>
        forEveryone
          ? messages.map((m) => (selected.has(m.id) ? { ...m, body: '', media: null, edited_at: null, revoked: true } : m))
          : messages.filter((m) => !selected.has(m.id)),
      );
      void queryClient.invalidateQueries({ queryKey: messageKeys.inbox });
    },
  });
}

/** « Supprimer la discussion » pour moi : l'autre membre garde l'historique. */
export function useClearConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (conversationId: string) =>
      unwrap(api.POST('/api/messages/conversations/{conversation_id}/clear/', { params: { path: { conversation_id: conversationId } } })),
    onSuccess: (_result, conversationId) => {
      queryClient.removeQueries({ queryKey: messageKeys.thread(conversationId) });
      void queryClient.invalidateQueries({ queryKey: messageKeys.inbox });
      void queryClient.invalidateQueries({ queryKey: messageKeys.unread });
    },
  });
}

export function useMarkRead() {
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
