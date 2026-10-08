'use client';

import { useQueryClient } from '@tanstack/react-query';
import { Clock, MessageSquareReply, Send, Sparkles, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { errorMessage } from '@/shared/api';
import { useAutosaveDraft } from '@/shared/drafts';
import { cn } from '@/shared/lib';
import { useOutbox } from '@/shared/offline';
import { useLiveSocket } from '@/shared/realtime/useLiveSocket';
import { SecretAlert, useSecretScan } from '@/shared/security-guard';
import { useSession } from '@/shared/session';
import { Avatar, Button, Markdown, pillAction, Skeleton, Textarea, TimeAgo, useToast } from '@/shared/ui';

import { type Comment, deleteComment, discussionKeys, sendComment, useComments, useThreadSummary } from '../api';

interface LiveEvent {
  event: 'comment.created' | 'comment.deleted';
}

/** Fil de commentaires d'un post, façon Reddit : résumé IA, réponses imbriquées, envoi hors ligne. */
export function CommentThread({ postId, commentCount }: { postId: string; commentCount: number }) {
  const queryClient = useQueryClient();
  const { isAuthenticated, user } = useSession();
  const comments = useComments(postId);
  const summary = useThreadSummary(postId, commentCount >= 5);
  const pending = useOutbox('comments').filter((entry) => entry.data.post_id === postId);
  const [replyTo, setReplyTo] = useState<string | null>(null);

  useLiveSocket<LiveEvent>(isAuthenticated ? `/ws/discussions/${postId}/` : null, () => {
    void queryClient.invalidateQueries({ queryKey: discussionKeys.comments(postId) });
    void queryClient.invalidateQueries({ queryKey: discussionKeys.summary(postId) });
  });

  const byParent = new Map<string | null, Comment[]>();
  for (const comment of comments.items) {
    const key = comment.parent_id ?? null;
    byParent.set(key, [...(byParent.get(key) ?? []), comment]);
  }
  const roots = byParent.get(null) ?? [];

  return (
    <section aria-label="Commentaires" className="space-y-5">
      {isAuthenticated ? (
        <CommentForm postId={postId} placeholder="Ajouter un commentaire…" />
      ) : (
        <p className="rounded-xl bg-container-low p-4 text-body-md text-ink-muted">
          <Link href="/login" className="font-semibold text-primary-ink hover:underline">
            Connectez-vous
          </Link>{' '}
          pour participer à la discussion.
        </p>
      )}

      {summary.data?.points.length ? (
        <div className="rounded-xl bg-secondary-soft/60 p-4">
          <p className="mb-2 flex items-center gap-2 text-body-md font-bold text-on-secondary-soft">
            <Sparkles className="size-4" aria-hidden /> Résumé IA de la discussion
            <span className="font-medium opacity-80">· {summary.data.comment_count} commentaires</span>
          </p>
          <ol className="space-y-1.5">
            {summary.data.points.map((point, index) => (
              <li key={index} className="flex gap-2.5 text-body-md text-ink">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-secondary text-label-md font-bold text-white">
                  {index + 1}
                </span>
                {point}
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      <div className="flex items-center justify-between">
        <h2 className="text-headline-md text-ink">
          {commentCount} commentaire{commentCount > 1 ? 's' : ''}
        </h2>
      </div>

      {comments.isPending ? (
        <div className="space-y-4">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      ) : roots.length || pending.length ? (
        <ul className="space-y-5">
          {roots.map((comment) => (
            <li key={comment.id}>
              <CommentItem
                comment={comment}
                postId={postId}
                mine={comment.author?.id === user?.id}
                replying={replyTo === comment.id}
                onReply={isAuthenticated ? () => setReplyTo(replyTo === comment.id ? null : comment.id) : undefined}
                onReplied={() => setReplyTo(null)}
              />
              {(byParent.get(comment.id) ?? []).length ? (
                <ul className="mt-3 ml-3.5 space-y-4 border-l-2 border-line pl-5">
                  {(byParent.get(comment.id) ?? []).map((reply) => (
                    <li key={reply.id}>
                      <CommentItem comment={reply} postId={postId} mine={reply.author?.id === user?.id} />
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
          {pending.map((entry) => (
            <li key={entry.id} className="flex items-start gap-3 rounded-xl border border-dashed border-line-strong p-3">
              <Clock className="mt-0.5 size-4 shrink-0 text-offline" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-body-sm font-semibold text-offline">En attente de réseau</p>
                <p className="mt-1 text-body-md text-ink">{String(entry.data.body)}</p>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="py-6 text-center text-body-md text-ink-muted">Pas encore de commentaire. Lancez la discussion !</p>
      )}
      {comments.hasNextPage ? (
        <Button variant="ghost" size="sm" onClick={() => comments.fetchNextPage()} loading={comments.isFetchingNextPage}>
          Voir plus de commentaires
        </Button>
      ) : null}
    </section>
  );
}

function CommentItem({
  comment,
  postId,
  mine,
  replying = false,
  onReply,
  onReplied,
}: {
  comment: Comment;
  postId: string;
  mine: boolean;
  replying?: boolean;
  onReply?: () => void;
  onReplied?: () => void;
}) {
  const queryClient = useQueryClient();
  const name = comment.author?.display_name || comment.author?.username || 'Membre';
  return (
    <div className="flex gap-3">
      <Avatar name={name} src={comment.author?.avatar_url} size={32} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-1.5 text-body-sm">
          {comment.author ? (
            <Link href={`/u/${comment.author.username}`} className="font-bold text-ink hover:underline">
              {name}
            </Link>
          ) : (
            <span className="font-bold">{name}</span>
          )}
          <span className="text-ink-faint" aria-hidden>
            •
          </span>
          <TimeAgo date={comment.created_at} className="text-ink-faint" />
        </div>
        <div className="mt-1 text-body-md">
          <Markdown source={comment.body} />
        </div>
        <div className="-ml-3 mt-1 flex">
          {onReply ? (
            <button type="button" onClick={onReply} className={cn(pillAction, replying && 'bg-container text-ink')}>
              <MessageSquareReply className="size-4" aria-hidden /> Répondre
            </button>
          ) : null}
          {mine ? (
            <button
              type="button"
              onClick={async () => {
                if (!window.confirm('Supprimer ce commentaire ?')) return;
                await deleteComment(comment.id);
                void queryClient.invalidateQueries({ queryKey: discussionKeys.comments(postId) });
              }}
              className={cn(pillAction, 'hover:text-danger')}
            >
              <Trash2 className="size-4" aria-hidden /> Supprimer
            </button>
          ) : null}
        </div>
        {replying ? (
          <div className="mt-2">
            <CommentForm postId={postId} parentId={comment.id} placeholder={`Répondre à ${name}…`} onDone={onReplied} autoFocus />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function CommentForm({
  postId,
  parentId,
  placeholder,
  onDone,
  autoFocus,
}: {
  postId: string;
  parentId?: string;
  placeholder: string;
  onDone?: () => void;
  autoFocus?: boolean;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [body, setBody] = useState('');
  const [focused, setFocused] = useState(Boolean(autoFocus));
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const draft = useAutosaveDraft(parentId ? `reply:${parentId}` : `comment:${postId}`, body, setBody);
  const findings = useSecretScan(body);
  const open = focused || Boolean(body);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!body.trim() || findings.length) return;
    setSending(true);
    setError(null);
    try {
      const result = await sendComment(postId, body.trim(), parentId);
      setBody('');
      setFocused(false);
      await draft.clear();
      onDone?.();
      if (result.queued) toast('Hors ligne : commentaire envoyé au retour du réseau.', 'queued');
      else void queryClient.invalidateQueries({ queryKey: discussionKeys.comments(postId) });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-2">
      <div
        className={cn(
          'overflow-hidden rounded-2xl border bg-card transition-colors',
          open ? 'border-primary ring-3 ring-primary/10' : 'border-line-strong hover:border-ink-faint',
        )}
      >
        <Textarea
          aria-label={placeholder}
          placeholder={placeholder}
          value={body}
          autoFocus={autoFocus}
          onFocus={() => setFocused(true)}
          onChange={(event) => setBody(event.target.value)}
          className={cn('resize-none border-0 bg-transparent px-4 focus:ring-0', open ? 'min-h-24' : 'min-h-11 py-2.5')}
          rows={open ? 3 : 1}
          maxLength={2000}
        />
        {open ? (
          <div className="flex justify-end gap-2 px-2 pb-2">
            <Button
              variant="plain"
              size="sm"
              onClick={() => {
                setBody('');
                setFocused(false);
                onDone?.();
              }}
            >
              Annuler
            </Button>
            <Button type="submit" size="sm" loading={sending} disabled={!body.trim() || findings.length > 0}>
              <Send className="size-3.5" aria-hidden /> {parentId ? 'Répondre' : 'Commenter'}
            </Button>
          </div>
        ) : null}
      </div>
      <SecretAlert findings={findings} />
      {error ? (
        <p role="alert" className="text-body-sm text-danger">
          {error}
        </p>
      ) : null}
    </form>
  );
}
