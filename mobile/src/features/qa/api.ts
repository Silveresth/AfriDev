import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api, type Schemas, unwrap } from '@/shared/api';
import type { Key } from '@/shared/i18n';
import { useInfiniteList } from '@/shared/query';

export type Question = Schemas['QuestionOutput'];
export type Answer = Schemas['AnswerOutput'];

export type QuestionStatus = 'all' | 'open' | 'resolved';

export const STATUSES: { value: QuestionStatus; label: Key }[] = [
  { value: 'all', label: 'qa.all' },
  { value: 'open', label: 'qa.open' },
  { value: 'resolved', label: 'qa.resolved' },
];

export interface QuestionFilters {
  q?: string;
  status?: QuestionStatus;
  hub?: string;
  author?: string;
}

export const qaKeys = {
  all: ['qa'] as const,
  list: (filters: QuestionFilters) => ['qa', 'list', filters] as const,
  detail: (id: string) => ['qa', 'question', id] as const,
  answers: (id: string) => ['qa', 'question', id, 'answers'] as const,
};

export function useQuestions({ status = 'all', ...filters }: QuestionFilters = {}, options: { enabled?: boolean } = {}) {
  const resolved = status === 'all' ? undefined : status === 'resolved';
  return useInfiniteList(
    qaKeys.list({ status, ...filters }),
    (cursor) =>
      unwrap(api.GET('/api/qa/questions/', { params: { query: { cursor, resolved, ...filters, q: filters.q || undefined } } })),
    options,
  );
}

export function useQuestion(id: string) {
  return useQuery({
    queryKey: qaKeys.detail(id),
    queryFn: () => unwrap(api.GET('/api/qa/questions/{question_id}/', { params: { path: { question_id: id } } })),
    // La réponse IA arrive quelques secondes après la publication : on la guette.
    refetchInterval: (query) => (query.state.data?.ai_answer_status === 'pending' ? 2500 : false),
  });
}

export function useAnswers(questionId: string) {
  return useQuery({
    queryKey: qaKeys.answers(questionId),
    queryFn: () => unwrap(api.GET('/api/qa/questions/{question_id}/answers/', { params: { path: { question_id: questionId } } })),
  });
}

export function useSimilarQuestions(text: string) {
  return useQuery({
    queryKey: ['qa', 'similar', text],
    queryFn: () => unwrap(api.GET('/api/qa/similar/', { params: { query: { q: text } } })),
    enabled: text.trim().length >= 15,
    staleTime: 5 * 60_000,
  });
}

export function useAskQuestion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { title: string; body: string; tags: string[]; hub_id?: string | null }) =>
      unwrap(api.POST('/api/qa/questions/', { body: { ...input, hub_id: input.hub_id ?? null } })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['qa', 'list'] }),
  });
}

export function useAnswerActions(questionId: string) {
  const queryClient = useQueryClient();
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: qaKeys.answers(questionId) });
    void queryClient.invalidateQueries({ queryKey: qaKeys.detail(questionId) });
  };
  const create = useMutation({
    mutationFn: (body: string) =>
      unwrap(api.POST('/api/qa/questions/{question_id}/answers/', { params: { path: { question_id: questionId } }, body: { body } })),
    onSuccess: refresh,
  });
  const accept = useMutation({
    mutationFn: (answerId: string) =>
      unwrap(api.POST('/api/qa/answers/{answer_id}/accept/', { params: { path: { answer_id: answerId } } })),
    onSuccess: refresh,
  });
  const vote = useMutation({
    mutationFn: ({ answerId, value }: { answerId: string; value: -1 | 0 | 1 }) =>
      unwrap(api.POST('/api/qa/answers/{answer_id}/vote/', { params: { path: { answer_id: answerId } }, body: { value } })),
    onSuccess: refresh,
  });
  return { create, accept, vote };
}
