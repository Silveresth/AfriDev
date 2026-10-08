'use client';

import { CardSkeleton, EmptyState } from '@/shared/ui';

import { useQuestions } from '../api';
import { QuestionRow } from './QuestionsScreen';

/** Questions posées par un membre (onglet du profil). */
export function AuthorQuestions({ authorId }: { authorId: string }) {
  const questions = useQuestions({ author: authorId });
  if (questions.isPending) return <CardSkeleton lines={2} />;
  if (!questions.items.length) return <EmptyState title="Aucune question posée" />;
  return (
    <div className="space-y-3">
      {questions.items.map((question) => (
        <QuestionRow key={question.id} question={question} compact />
      ))}
    </div>
  );
}