import type { Schemas } from '@afridev/api-client';
import type { Metadata } from 'next';

import { OpenQuestionsCard, QuestionDetail } from '@/features/qa';
import { serverGet } from '@/shared/api/server';

type Props = { params: Promise<{ id: string }> };

const getQuestion = (id: string) =>
  serverGet<Schemas['QuestionOutput']>(`/api/qa/questions/${encodeURIComponent(id)}/`);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const question = await getQuestion((await params).id);
  if (!question) return { title: 'Question' };
  return {
    title: question.title,
    description: question.body.slice(0, 160),
    openGraph: { title: question.title, type: 'article' },
  };
}

/** Page publique rendue côté serveur (référencement, premier affichage rapide). */
export default async function QuestionPage({ params }: Props) {
  const { id } = await params;
  const question = await getQuestion(id);
  return <QuestionDetail id={id} initial={question ?? undefined} aside={<OpenQuestionsCard />} />;
}
