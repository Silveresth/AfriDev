'use client';

import type { Schemas } from '@afridev/api-client';
import { useQuery } from '@tanstack/react-query';

import { api, unwrap } from '@/shared/api';
import { sendOrQueue } from '@/shared/offline';
import { useInfiniteList } from '@/shared/query';

export type Comment = Schemas['CommentOutput'];

export const discussionKeys = {
  comments: (postId: string) => ['discussions', postId, 'comments'] as const,
  summary: (postId: string) => ['discussions', postId, 'summary'] as const,
};

export function useComments(postId: string) {
  return useInfiniteList(discussionKeys.comments(postId), (cursor) =>
    unwrap(
      api.GET('/api/discussions/posts/{post_id}/comments/', {
        params: { path: { post_id: postId }, query: { cursor } },
      }),
    ),
  );
}

export function useThreadSummary(postId: string, enabled: boolean) {
  return useQuery({
    queryKey: discussionKeys.summary(postId),
    queryFn: () =>
      unwrap(api.GET('/api/discussions/posts/{post_id}/summary/', { params: { path: { post_id: postId } } })),
    enabled,
  });
}

/** Commentaire publié tout de suite, ou mis en file si le réseau manque. */
export function sendComment(postId: string, body: string, parentId?: string) {
  const id = crypto.randomUUID();
  return sendOrQueue(
    () =>
      unwrap(
        api.POST('/api/discussions/posts/{post_id}/comments/', {
          params: { path: { post_id: postId } },
          body: { id, body, parent_id: parentId ?? null },
        }),
      ),
    {
      id,
      op: 'PUT',
      type: 'comments',
      data: { post_id: postId, body, parent_id: parentId ?? null },
      label: `Commentaire : ${body.slice(0, 40)}`,
    },
  );
}

export const deleteComment = (commentId: string) =>
  unwrap(api.DELETE('/api/discussions/comments/{comment_id}/', { params: { path: { comment_id: commentId } } }));
