'use client';

import { MessagesSquare, Plus } from 'lucide-react';

import { useSession } from '@/shared/session';
import { Button, ButtonLink, CardSkeleton, EmptyState, ErrorNotice } from '@/shared/ui';

import { useQuestions } from '../api';
import { QuestionRow } from './QuestionsScreen';

/** Questions d'un hub (onglet Q&A de /h/<slug>). */
export function HubQuestions({ hub }: { hub: string }) {
  const { isAuthenticated } = useSession();
  const questions = useQuestions({ hub });
  const askHref = `/questions/new?hub=${encodeURIComponent(hub)}`;

  if (questions.isPending) return <CardSkeleton lines={2} />;
  if (questions.isError && !questions.items.length) {
    return <ErrorNotice message="Les questions du hub s'afficheront dès le retour du réseau." />;
  }
  return (
    <div className="space-y-3">
      {questions.items.length ? (
        <>
          {isAuthenticated ? (
            <div className="flex justify-end">
              <ButtonLink href={askHref} variant="outline" size="sm">
                <Plus className="size-4" aria-hidden /> Poser une question ici
              </ButtonLink>
            </div>
          ) : null}
          <ul className="space-y-3">
            {questions.items.map((question) => (
              <li key={question.id}>
                <QuestionRow question={question} />
              </li>
            ))}
          </ul>
        </>
      ) : (
        <EmptyState
          icon={<MessagesSquare aria-hidden />}
          title="Aucune question dans ce hub"
          action={isAuthenticated ? <ButtonLink href={askHref}>Poser la première</ButtonLink> : undefined}
        >
          Les membres du hub et l&apos;IA vous répondent en quelques minutes.
        </EmptyState>
      )}
      {questions.hasNextPage ? (
        <Button variant="outline" className="w-full" onClick={() => questions.fetchNextPage()} loading={questions.isFetchingNextPage}>
          Voir plus de questions
        </Button>
      ) : null}
    </div>
  );
}
