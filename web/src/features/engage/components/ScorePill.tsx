'use client';

import { ThumbsDown, ThumbsUp } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { cn, formatCount } from '@/shared/lib';
import { useSession } from '@/shared/session';

/** 👍 score 👎 : capsule à filet ; elle prend la couleur du vote donné. Recliquer retire le vote. */
export function ScorePill({
  score,
  value,
  onVote,
  loginNext,
}: {
  score: number;
  value: number;
  onVote: (value: -1 | 0 | 1) => void;
  /** Page où revenir après connexion. */
  loginNext: string;
}) {
  const { isAuthenticated } = useSession();
  const router = useRouter();
  const cast = (next: 1 | -1) => {
    if (!isAuthenticated) {
      router.push(`/login?next=${encodeURIComponent(loginNext)}`);
      return;
    }
    onVote(value === next ? 0 : next);
  };
  return (
    <div
      className={cn(
        'mr-0.5 inline-flex h-8 items-center rounded-lg border transition-colors sm:mr-1',
        value === 1
          ? 'border-primary/30 bg-primary-soft text-primary-ink'
          : value === -1
            ? 'border-downvote/30 bg-downvote-soft text-downvote'
            : 'border-line bg-card text-ink',
      )}
    >
      <button
        type="button"
        aria-label="Pouce levé"
        aria-pressed={value === 1}
        onClick={() => cast(1)}
        className="flex h-full w-8 items-center justify-center rounded-l-lg transition-colors hover:bg-primary-soft hover:text-primary"
      >
        <ThumbsUp className={cn('size-4', value === 1 && 'fill-current')} aria-hidden />
      </button>
      <span className="min-w-[1.5rem] text-center text-body-sm font-semibold tabular-nums" aria-label={`Score : ${score}`}>
        {formatCount(score)}
      </span>
      <button
        type="button"
        aria-label="Pouce baissé"
        aria-pressed={value === -1}
        onClick={() => cast(-1)}
        className="flex h-full w-8 items-center justify-center rounded-r-lg transition-colors hover:bg-downvote-soft hover:text-downvote"
      >
        <ThumbsDown className={cn('size-4', value === -1 && 'fill-current')} aria-hidden />
      </button>
    </div>
  );
}
