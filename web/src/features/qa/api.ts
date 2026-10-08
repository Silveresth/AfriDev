'use client';

import type { Schemas } from '@afridev/api-client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api, unwrap, waitForJob } from '@/shared/api';
import { uploadMedia } from '@/shared/media';
import { sendOrQueue } from '@/shared/offline';
import { useInfiniteList } from '@/shared/query';

export type Question = Schemas['QuestionOutput'];
export type Answer = Schemas['AnswerOutput'];
export type SimilarQuestion = Schemas['SimilarQuestion'];

export interface QuestionFilters {
  q?: string;
  tag?: string;
  resolved?: boolean;
  author?: string;
  /** Slug ou UUID du hub. */
  hub?: string;
}

export const qaKeys = {
  all: ['qa'] as const,
  list: (filters: QuestionFilters) => ['qa', 'list', filters] as const,
  detail: (id: string) => ['qa', 'question', id] as const,
  answers: (id: string) => ['qa', 'question', id, 'answers'] as const,
  similar: (text: string) => ['qa', 'similar', text] as const,
};

export function useQuestions(filters: QuestionFilters = {}) {
  return useInfiniteList(qaKeys.list(filters), (cursor) =>
    unwrap(api.GET('/api/qa/questions/', { params: { query: { cursor, ...filters } } })),
  );
}

export function useQuestion(id: string, initialData?: Question) {
  return useQuery({
    queryKey: qaKeys.detail(id),
    queryFn: () => unwrap(api.GET('/api/qa/questions/{question_id}/', { params: { path: { question_id: id } } })),
    initialData,
    // La réponse IA arrive quelques secondes après la publication : on la guette.
    refetchInterval: (query) => (query.state.data?.ai_answer_status === 'pending' ? 2500 : false),
  });
}

export function useAnswers(questionId: string) {
  return useQuery({
    queryKey: qaKeys.answers(questionId),
    queryFn: () =>
      unwrap(api.GET('/api/qa/questions/{question_id}/answers/', { params: { path: { question_id: questionId } } })),
  });
}

export function useSimilarQuestions(text: string) {
  return useQuery({
    queryKey: qaKeys.similar(text),
    queryFn: () => unwrap(api.GET('/api/qa/similar/', { params: { query: { q: text } } })),
    enabled: text.trim().length >= 15,
    staleTime: 5 * 60_000,
    meta: { persist: false },
  });
}

export interface NewQuestion {
  title: string;
  body: string;
  tags: string[];
  audio_media_id?: string | null;
  hub_id?: string | null;
}

export function askQuestion(input: NewQuestion) {
  const id = crypto.randomUUID();
  return sendOrQueue(
    () => unwrap(api.POST('/api/qa/questions/', { body: { id, ...input } })),
    {
      id,
      op: 'PUT',
      type: 'questions',
      data: { title: input.title, body: input.body, tags: input.tags, hub_id: input.hub_id ?? null },
      label: `Question : ${input.title.slice(0, 40)}`,
    },
  );
}

export function useCreateAnswer(questionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => {
      const id = crypto.randomUUID();
      return sendOrQueue(
        () =>
          unwrap(
            api.POST('/api/qa/questions/{question_id}/answers/', {
              params: { path: { question_id: questionId } },
              body: { id, body },
            }),
          ),
        { id, op: 'PUT', type: 'answers', data: { question_id: questionId, body }, label: `Réponse : ${body.slice(0, 40)}` },
      );
    },
    onSuccess: (outcome) => {
      if (outcome.queued) return;
      void queryClient.invalidateQueries({ queryKey: qaKeys.answers(questionId) });
      void queryClient.invalidateQueries({ queryKey: qaKeys.detail(questionId) });
    },
  });
}

export function useAnswerActions(questionId: string) {
  const queryClient = useQueryClient();
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: qaKeys.answers(questionId) });
    void queryClient.invalidateQueries({ queryKey: qaKeys.detail(questionId) });
  };
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
  const remove = useMutation({
    mutationFn: (answerId: string) =>
      unwrap(api.DELETE('/api/qa/answers/{answer_id}/', { params: { path: { answer_id: answerId } } })),
    onSuccess: refresh,
  });
  return { accept, vote, remove };
}

export function useRegenerateAiAnswer(questionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      unwrap(api.POST('/api/qa/questions/{question_id}/ai-answer/', { params: { path: { question_id: questionId } } })),
    onSuccess: (question) => queryClient.setQueryData(qaKeys.detail(questionId), question),
  });
}

export function useDeleteQuestion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      unwrap(api.DELETE('/api/qa/questions/{question_id}/', { params: { path: { question_id: id } } })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qaKeys.all }),
  });
}

/** Reformulation proposée par l'IA (à accepter ou refuser). */
export async function rephraseQuestion(title: string, body: string) {
  const { job_id } = await unwrap(api.POST('/api/qa/rephrase/', { body: { title, body } }));
  return waitForJob<{ title: string; body: string }>(job_id);
}

/** Question vocale : envoi du message (Opus côté serveur) puis transcription Whisper. */
export async function transcribeVoice(audio: Blob) {
  // « audio/webm;codecs=opus » -> « audio/webm » (le backend vérifie le type MIME exact).
  const type = (audio.type || 'audio/webm').split(';')[0] ?? 'audio/webm';
  const file = new File([audio], `question.${type.includes('ogg') ? 'ogg' : 'webm'}`, { type });
  const media = await uploadMedia(file, 'audio');
  const { job_id } = await unwrap(api.POST('/api/qa/transcribe/', { body: { media_id: media.id, language: 'fr' } }));
  const { text } = await waitForJob<{ text: string }>(job_id, { timeout: 120_000 });
  return { text, mediaId: media.id };
}
