'use client';

import type { QueryKey } from '@tanstack/react-query';
import { ThumbsDown, ThumbsUp } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { ReportButton } from '@/features/moderation';
import { cn, formatCount } from '@/shared/lib';
import { useSession } from '@/shared/session';

import { type CommentTarget, useCommentVote, type Votable } from '../api';

/**
 * Actions d'un commentaire : 👍 score 👎 (recliquer retire le vote) et signaler.
 * `listKey` : clé de la liste paginée qui affiche le commentaire (mise à jour immédiate).
 */
export function CommentReactions({
  type,
  comment,
  listKey,
  loginNext,
  mine = false,
}: {
  type: CommentTarget;
  comment: Votable;
  listKey: QueryKey;
  /** Page où revenir après connexion. */
  loginNext: string;
  /** Son propre commentaire : pas de signalement. */
  mine?: boolean;
}) {
  const { isAuthenticated } = useSession();
  const router = useRouter();
  const vote = useCommentVote(type, comment, listKey);
  const value = comment.viewer_vote ?? 0;
  const score = comment.score ?? 0;

  const cast = (next: 1 | -1) => {
    if (!isAuthenticated) {
      router.push(`/login?next=${encodeURIComponent(loginNext)}`);
      return;
    }
    vote.mutate(value === next ? 0 : next);
  };

  const button = 'flex size-7 items-center justify-center rounded-md transition-colors';
  return (
    <span className="inline-flex items-center gap-0.5">
      <span
        className={cn(
          'inline-flex items-center rounded-lg',
          value === 1 ? 'text-primary-ink' : value === -1 ? 'text-downvote' : 'text-ink-muted',
        )}
      >
        <button
          type="button"
          aria-label="Pouce levé"
          aria-pressed={value === 1}
          onClick={() => cast(1)}
          className={cn(button, 'hover:bg-primary-soft hover:text-primary')}
        >
          <ThumbsUp className={cn('size-3.5', value === 1 && 'fill-current')} aria-hidden />
        </button>
        <span className="min-w-[1.25rem] text-center text-label-md font-semibold tabular-nums" aria-label={`Score : ${score}`}>
          {formatCount(score)}
        </span>
        <button
          type="button"
          aria-label="Pouce baissé"
          aria-pressed={value === -1}
          onClick={() => cast(-1)}
          className={cn(button, 'hover:bg-downvote-soft hover:text-downvote')}
        >
          <ThumbsDown className={cn('size-3.5', value === -1 && 'fill-current')} aria-hidden />
        </button>
      </span>
      {!mine ? <ReportButton targetType={type} targetId={comment.id} compact /> : null}
    </span>
  );
}
