'use client';

import { MessageSquare } from 'lucide-react';

import { BookmarkButton } from '@/features/bookmarks';
import { ReportButton } from '@/features/moderation';
import { formatCount } from '@/shared/lib';
import { pillAction } from '@/shared/ui';

import { type TargetType, useReaction, useTargetComments } from '../api';

import { ShareButton } from './CardActions';
import { ScorePill } from './ScorePill';

/** Barre d'actions d'une page projet / offre : voter, commenter, partager, enregistrer, signaler. */
export function DetailActions({ type, id, title, path, mine }: { type: TargetType; id: string; title: string; path: string; mine: boolean }) {
  const { summary, vote } = useReaction(type, id);
  const comments = useTargetComments(type, id);
  return (
    <div className="flex flex-wrap items-center gap-1">
      <ScorePill
        score={summary.data?.score ?? 0}
        value={summary.data?.viewer_vote ?? 0}
        onVote={(value) => vote.mutate(value)}
        loginNext={path}
      />
      <a href="#comments" className={pillAction}>
        <MessageSquare className="size-4" aria-hidden /> {formatCount(comments.items.length)}
        <span className="hidden sm:inline">commentaire(s)</span>
      </a>
      <ShareButton path={path} title={title} />
      <span className="ml-auto flex items-center">
        <BookmarkButton target={{ type, id }} title={title} />
        {!mine ? <ReportButton targetType={type} targetId={id} compact /> : null}
      </span>
    </div>
  );
}
