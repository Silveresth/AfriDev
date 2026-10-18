'use client';

import { MessageSquare, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { useSession } from '@/shared/session';
import { Avatar, Button, Card, MentionText, MentionTextarea, Spinner, TimeAgo } from '@/shared/ui';
import { cn } from '@/shared/lib';

import {
  type SnippetComment,
  useAddComment,
  useDeleteComment,
  useSnippetComments,
} from '../api';

// ─── Helper: CommentForm ─────────────────────────────────────────────────────

function CommentForm({
  snippetId,
  parentId,
  placeholder = 'Écrivez un commentaire…',
  onSuccess,
}: {
  snippetId: string;
  parentId?: string | null;
  placeholder?: string;
  onSuccess?: () => void;
}) {
  const [body, setBody] = useState('');
  const add = useAddComment(snippetId);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = body.trim();
    if (!trimmed) return;
    add.mutate(
      { body: trimmed, parent_id: parentId ?? null },
      {
        onSuccess: () => {
          setBody('');
          onSuccess?.();
        },
      },
    );
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <MentionTextarea
        value={body}
        onValueChange={setBody}
        placeholder={placeholder}
        rows={3}
        className="min-h-20 resize-none text-body-sm"
      />
      <div className="flex justify-end gap-2">
        {onSuccess ? (
          <Button type="button" variant="ghost" size="sm" onClick={onSuccess}>
            Annuler
          </Button>
        ) : null}
        <Button type="submit" size="sm" loading={add.isPending} disabled={!body.trim()}>
          Envoyer
        </Button>
      </div>
    </form>
  );
}

// ─── Helper: SingleComment ───────────────────────────────────────────────────

function SingleComment({
  comment,
  snippetId,
  currentUserId,
  depth = 0,
  replies,
}: {
  comment: SnippetComment;
  snippetId: string;
  currentUserId?: string;
  depth?: number;
  replies?: SnippetComment[];
}) {
  const [replyOpen, setReplyOpen] = useState(false);
  const del = useDeleteComment(snippetId);

  const author = comment.author;
  const displayName = author?.display_name ?? 'Utilisateur';
  const username = author?.username ?? '';
  const avatarUrl = author?.avatar_url ?? null;
  const isMine = Boolean(currentUserId && author?.id === currentUserId);
  const canReply = depth === 0;

  return (
    <div className={cn('flex gap-3', depth > 0 && 'pl-6 border-l-2 border-line')}>
      <Avatar name={displayName} src={avatarUrl} size={32} className="mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <Link
            href={`/u/${username}`}
            className="text-body-sm font-semibold text-ink hover:underline"
          >
            {displayName}
          </Link>
          <span className="text-label-md text-ink-faint">@{username}</span>
          <span className="text-label-md text-ink-faint">·</span>
          <TimeAgo date={comment.created_at} className="text-label-md text-ink-faint" />
        </div>
        <p className="whitespace-pre-wrap text-body-sm text-ink">
          <MentionText text={comment.body} />
        </p>
        <div className="flex items-center gap-3 pt-0.5">
          {canReply ? (
            <button
              type="button"
              onClick={() => setReplyOpen((v) => !v)}
              className="text-label-md text-ink-muted hover:text-ink transition-colors"
            >
              {replyOpen ? 'Annuler' : 'Répondre'}
            </button>
          ) : null}
          {isMine ? (
            <button
              type="button"
              onClick={() => del.mutate(comment.id)}
              disabled={del.isPending}
              className="flex items-center gap-1 text-label-md text-ink-muted hover:text-danger transition-colors disabled:opacity-50"
            >
              {del.isPending ? (
                <Spinner className="size-3" />
              ) : (
                <Trash2 className="size-3" aria-hidden />
              )}
              Supprimer
            </button>
          ) : null}
        </div>

        {replyOpen && canReply ? (
          <div className="pt-2">
            <CommentForm
              snippetId={snippetId}
              parentId={comment.id}
              placeholder="Répondre à ce commentaire…"
              onSuccess={() => setReplyOpen(false)}
            />
          </div>
        ) : null}

        {replies?.length ? (
          <div className="mt-3 space-y-4">
            {replies.map((reply) => (
              <SingleComment
                key={reply.id}
                comment={reply}
                snippetId={snippetId}
                currentUserId={currentUserId}
                depth={1}
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ─── Main: SnippetComments ───────────────────────────────────────────────────

export function SnippetComments({
  snippetId,
  isPublic,
}: {
  snippetId: string;
  isPublic: boolean;
}) {
  const { isAuthenticated, profile } = useSession();
  const comments = useSnippetComments(snippetId);

  // Only show on public snippets
  if (!isPublic) return null;

  const allComments = comments.items as SnippetComment[];
  const roots = allComments.filter((c) => c.parent_id === null);
  const replies = allComments.filter((c) => c.parent_id !== null);
  const repliesByParent = replies.reduce<Record<string, SnippetComment[]>>((acc, r) => {
    const pid = r.parent_id!;
    if (!acc[pid]) acc[pid] = [];
    acc[pid].push(r);
    return acc;
  }, {});

  return (
    <Card className="space-y-6 p-4 sm:p-6">
      {/* Header */}
      <h2 className="flex items-center gap-2 text-headline-md text-ink">
        <MessageSquare className="size-5 text-primary-ink" aria-hidden />
        Commentaires
        {allComments.length > 0 ? (
          <span className="ml-1 rounded-full bg-container px-2 py-0.5 text-label-md text-ink-muted">
            {allComments.length}
          </span>
        ) : null}
      </h2>

      {/* Auth gate / new comment form */}
      {isAuthenticated ? (
        <CommentForm snippetId={snippetId} />
      ) : (
        <p className="text-body-sm text-ink-muted">
          <Link href="/login" className="font-semibold text-primary-ink hover:underline">
            Connectez-vous
          </Link>{' '}
          pour laisser un commentaire.
        </p>
      )}

      {/* Comment list */}
      {comments.isPending ? (
        <div className="flex justify-center py-6">
          <Spinner />
        </div>
      ) : roots.length === 0 ? (
        <p className="text-body-sm text-ink-faint">Aucun commentaire pour l&apos;instant.</p>
      ) : (

        <div className="space-y-6">
          {roots.map((comment) => (
            <SingleComment
              key={comment.id}
              comment={comment}
              snippetId={snippetId}
              currentUserId={profile?.id}
              replies={repliesByParent[comment.id]}
            />
          ))}
        </div>
      )}

      {/* Load more */}
      {comments.hasNextPage ? (
        <div className="flex justify-center">
          <Button
            variant="ghost"
            size="sm"
            loading={comments.isFetchingNextPage}
            onClick={() => comments.fetchNextPage()}
          >
            Voir plus
          </Button>
        </div>
      ) : null}
    </Card>
  );
}
