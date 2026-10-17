'use client';

import { MessageSquare, Reply, Send, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { ReportButton } from '@/features/moderation';
import { errorMessage } from '@/shared/api';
import { useSession } from '@/shared/session';
import { Avatar, Button, buttonClasses, Card, Skeleton, Textarea, TimeAgo, useToast } from '@/shared/ui';

import { type TargetComment, type TargetType, useTargetCommentActions, useTargetComments } from '../api';

/** Discussion complète sous un projet ou une offre d'emploi, avec réponses à un commentaire. */
export function TargetComments({ type, id, ownerId }: { type: TargetType; id: string; ownerId?: string | null }) {
  const comments = useTargetComments(type, id);
  const { send, remove } = useTargetCommentActions(type, id);
  const { user, isAuthenticated } = useSession();
  const toast = useToast();
  const [replyTo, setReplyTo] = useState<TargetComment | null>(null);
  const roots = comments.items.filter((comment) => !comment.parent_id);
  const replies = (parentId: string) => comments.items.filter((comment) => comment.parent_id === parentId);
  const here = type === 'project' ? `/projects/${id}` : `/jobs/${id}`;

  const canDelete = (comment: TargetComment) =>
    Boolean(user && (comment.author?.id === user.id || ownerId === user.id || user.is_staff));

  const row = (comment: TargetComment, nested = false) => {
    const name = comment.author?.display_name || comment.author?.username || 'Membre';
    return (
      <li key={comment.id} className={nested ? 'ml-10' : undefined}>
        <div className="flex gap-2.5">
          {comment.author ? (
            <Link href={`/u/${comment.author.username}`} className="shrink-0" aria-label={name}>
              <Avatar name={name} src={comment.author.avatar_url} size={nested ? 28 : 36} />
            </Link>
          ) : (
            <Avatar name={name} size={nested ? 28 : 36} />
          )}
          <div className="min-w-0 flex-1">
            <div className="rounded-xl bg-container-low px-3 py-2">
              <p className="flex items-center gap-1.5 text-label-md">
                <span className="font-semibold text-ink">{name}</span>
                <TimeAgo date={comment.created_at} className="text-ink-faint" />
              </p>
              <p className="text-body-sm whitespace-pre-line break-words text-ink">{comment.body}</p>
            </div>
            <div className="mt-0.5 flex items-center gap-1 text-label-md text-ink-faint">
              {isAuthenticated && !nested ? (
                <button type="button" onClick={() => setReplyTo(comment)} className="flex items-center gap-1 rounded px-1.5 py-1 hover:bg-container hover:text-ink">
                  <Reply className="size-3.5" aria-hidden /> Répondre
                </button>
              ) : null}
              {canDelete(comment) ? (
                <button
                  type="button"
                  onClick={() =>
                    window.confirm('Supprimer ce commentaire ?') &&
                    remove.mutate(comment.id, { onError: (error) => toast(errorMessage(error), 'error') })
                  }
                  className="flex items-center gap-1 rounded px-1.5 py-1 hover:bg-container hover:text-danger"
                >
                  <Trash2 className="size-3.5" aria-hidden /> Supprimer
                </button>
              ) : user && comment.author?.id !== user.id ? (
                <ReportButton targetType="target_comment" targetId={comment.id} compact />
              ) : null}
            </div>
          </div>
        </div>
        {!nested && replies(comment.id).length ? <ul className="mt-2 space-y-2">{replies(comment.id).map((reply) => row(reply, true))}</ul> : null}
      </li>
    );
  };

  return (
    <Card id="comments" className="scroll-mt-24 space-y-4 p-4 sm:p-6">
      <h2 className="flex items-center gap-2 text-headline-md text-ink">
        <MessageSquare className="size-5" aria-hidden /> Commentaires
        <span className="text-body-md font-normal text-ink-faint tabular-nums">{comments.items.length}</span>
      </h2>
      {comments.isPending ? (
        <Skeleton className="h-16" />
      ) : roots.length ? (
        <ul className="space-y-4">{roots.map((comment) => row(comment))}</ul>
      ) : (
        <p className="text-body-sm text-ink-muted">Aucun commentaire pour l&apos;instant : posez une question ou donnez votre avis.</p>
      )}
      {comments.hasNextPage ? (
        <Button variant="ghost" size="sm" onClick={() => comments.fetchNextPage()} loading={comments.isFetchingNextPage}>
          Commentaires suivants
        </Button>
      ) : null}
      {isAuthenticated ? (
        <Composer
          replyTo={replyTo}
          onCancelReply={() => setReplyTo(null)}
          sending={send.isPending}
          error={send.isError ? errorMessage(send.error) : null}
          onSend={(body, done) =>
            send.mutate(
              { body, parent_id: replyTo?.id },
              {
                onSuccess: () => {
                  done();
                  setReplyTo(null);
                },
              },
            )
          }
        />
      ) : (
        <Link href={`/login?next=${encodeURIComponent(here)}`} className={buttonClasses({ variant: 'outline', size: 'sm' })}>
          Se connecter pour commenter
        </Link>
      )}
    </Card>
  );
}

function Composer({
  replyTo,
  onCancelReply,
  sending,
  error,
  onSend,
}: {
  replyTo: TargetComment | null;
  onCancelReply: () => void;
  sending: boolean;
  error: string | null;
  onSend: (body: string, done: () => void) => void;
}) {
  const [body, setBody] = useState('');
  const text = body.trim();
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (text) onSend(text, () => setBody(''));
  };
  return (
    <form onSubmit={submit} className="space-y-2 border-t border-line pt-4">
      {replyTo ? (
        <p className="flex items-center gap-2 text-body-sm text-ink-muted">
          <Reply className="size-4" aria-hidden /> Réponse à <strong className="text-ink">{replyTo.author?.display_name ?? 'Membre'}</strong>
          <button type="button" onClick={onCancelReply} className="ml-auto text-label-md hover:text-ink">
            Annuler
          </button>
        </p>
      ) : null}
      <div className="flex items-end gap-2">
        <Textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder={replyTo ? 'Votre réponse…' : 'Écrire un commentaire…'}
          maxLength={2000}
          rows={2}
          className="flex-1"
          onKeyDown={(event) => {
            if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) submit(event);
          }}
        />
        <Button type="submit" loading={sending} disabled={!text} aria-label="Publier le commentaire">
          <Send className="size-4" aria-hidden />
        </Button>
      </div>
      {error ? <p className="text-body-sm text-danger">{error}</p> : null}
    </form>
  );
}
