'use client';

import { ThumbsUp, CheckCircle2, HandHelping, MessagesSquare } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { formatCount } from '@/shared/lib';
import { Button, CardSkeleton, EmptyState, FilterChips, TimeAgo } from '@/shared/ui';

import { useAuthorAnswers } from '../api';
import { AuthorQuestions } from './AuthorQuestions';

type View = 'accepted' | 'answers' | 'questions';

/** Onglet « Q&A & Entraide » du profil : solutions apportées, réponses, questions posées. */
export function AuthorHelp({ authorId }: { authorId: string }) {
  const [view, setView] = useState<View>('accepted');
  return (
    <div className="space-y-4">
      <FilterChips<View>
        value={view}
        onChange={setView}
        options={[
          { value: 'accepted', label: 'Solutions', icon: <CheckCircle2 className="size-4" aria-hidden /> },
          { value: 'answers', label: 'Toutes ses réponses', icon: <HandHelping className="size-4" aria-hidden /> },
          { value: 'questions', label: 'Questions posées', icon: <MessagesSquare className="size-4" aria-hidden /> },
        ]}
      />
      {view === 'questions' ? <AuthorQuestions authorId={authorId} /> : <AuthorAnswers authorId={authorId} acceptedOnly={view === 'accepted'} />}
    </div>
  );
}

function AuthorAnswers({ authorId, acceptedOnly }: { authorId: string; acceptedOnly: boolean }) {
  const answers = useAuthorAnswers(authorId, acceptedOnly ? true : undefined);
  if (answers.isPending) return <CardSkeleton lines={2} />;
  if (!answers.items.length) {
    return <EmptyState icon={<HandHelping aria-hidden />} title={acceptedOnly ? 'Aucune solution acceptée pour l’instant' : 'Aucune réponse publiée'} />;
  }
  return (
    <div className="space-y-2">
      <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card">
        {answers.items.map((answer) => (
          <li key={answer.id}>
            <Link href={`/questions/${answer.question_id}`} className="flex gap-3 px-4 py-3.5 transition-colors hover:bg-container-low">
              <span
                className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full ${answer.is_accepted ? 'bg-secondary-soft text-secondary-ink' : 'bg-container text-ink-faint'}`}
                title={answer.is_accepted ? 'Réponse acceptée' : undefined}
              >
                {answer.is_accepted ? <CheckCircle2 className="size-4" aria-hidden /> : <HandHelping className="size-4" aria-hidden />}
              </span>
              <span className="min-w-0 flex-1 space-y-1">
                <span className="line-clamp-1 text-body-md font-semibold text-ink">{answer.question_title}</span>
                <span className="line-clamp-2 text-body-sm text-ink-muted">{answer.excerpt}</span>
                <span className="flex items-center gap-3 text-label-md text-ink-faint tabular-nums">
                  <span className="flex items-center gap-0.5">
                    <ThumbsUp className="size-3.5" aria-hidden /> {formatCount(answer.score)}
                  </span>
                  <TimeAgo date={answer.created_at} />
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {answers.hasNextPage ? (
        <Button variant="ghost" className="w-full" onClick={() => answers.fetchNextPage()} loading={answers.isFetchingNextPage}>
          Charger plus
        </Button>
      ) : null}
    </div>
  );
}
