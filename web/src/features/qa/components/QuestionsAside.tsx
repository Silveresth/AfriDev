'use client';

import { CircleHelp, MessageCircle } from 'lucide-react';
import Link from 'next/link';

import { SideCard, Skeleton } from '@/shared/ui';

import { useQuestions } from '../api';

/** Questions encore sans réponse acceptée (colonne de droite). */
export function OpenQuestionsCard({ title = 'Questions sans réponse' }: { title?: string }) {
  const questions = useQuestions({ resolved: false });
  const items = questions.items.slice(0, 4);
  return (
    <SideCard title={title} icon={<CircleHelp aria-hidden />}>
      {questions.isPending ? (
        <div className="px-4 pb-4">
          <Skeleton className="h-16" />
        </div>
      ) : items.length ? (
        <ul>
          {items.map((question) => (
            <li key={question.id}>
              <Link href={`/questions/${question.id}`} className="block px-4 py-2 transition-colors hover:bg-container-low">
                <span className="line-clamp-2 text-body-sm font-medium text-ink">{question.title}</span>
                <span className="mt-0.5 flex items-center gap-1.5 text-label-md text-ink-faint">
                  <MessageCircle className="size-3.5" aria-hidden />
                  {question.answer_count} réponse{question.answer_count > 1 ? 's' : ''}
                  {question.tags[0] ? ` · d/${question.tags[0]}` : ''}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-4 pb-4 text-body-sm text-ink-muted">Toutes les questions ont une réponse acceptée. Bravo !</p>
      )}
      <Link href="/questions/new" className="block border-t border-line px-4 py-2.5 text-body-sm font-medium text-ink-muted transition-colors hover:bg-container-low hover:text-ink">
        Poser une question →
      </Link>
    </SideCard>
  );
}
