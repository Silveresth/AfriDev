'use client';

import type { Schemas } from '@afridev/api-client';
import { useMutation, useQuery } from '@tanstack/react-query';

import { api, unwrap, waitForJob } from '@/shared/api';
import { useSession } from '@/shared/session';

export interface JobMatch {
  score: number;
  verdict: string;
  strengths: string[];
  gaps: string[];
  plan: { step: string; resource: string }[];
}

export interface CodeIssue {
  severity: 'critique' | 'important' | 'mineur';
  category: string;
  line: number | null;
  title: string;
  detail: string;
  suggestion: string;
}

export interface CodeReview {
  summary: string;
  score: number;
  issues: CodeIssue[];
}

export interface TeamCandidate {
  username: string;
  display_name: string;
  avatar_url: string;
  stack: string[];
  open_to_work: boolean;
  fit: number;
  role: string;
  reason: string;
}

export type Digest = NonNullable<Schemas['DigestResponse']['digest']>;

const SLOW = { timeout: 120_000, interval: 1200 };

/** 1. Score de correspondance offre ↔ profil, avec plan d'apprentissage. */
export function useJobMatch() {
  return useMutation({
    mutationFn: async (jobId: string) => {
      const { job_id } = await unwrap(api.POST('/api/assistant/job-match/', { body: { job_id: jobId } }));
      return waitForJob<JobMatch>(job_id, SLOW);
    },
  });
}

/** 3. Relecture de code (snippet publié ou code collé). */
export function useCodeReview() {
  return useMutation({
    mutationFn: async (input: { snippet_id?: string; code?: string; language?: string }) => {
      const { job_id } = await unwrap(
        api.POST('/api/assistant/code-review/', {
          body: { snippet_id: input.snippet_id ?? null, code: input.code ?? '', language: input.language ?? '' },
        }),
      );
      return waitForJob<CodeReview>(job_id, SLOW);
    },
  });
}

/** 4. Trois réponses rapides suggérées dans une conversation. */
export function useChatReplies() {
  return useMutation({
    mutationFn: async (conversationId: string) => {
      const { job_id } = await unwrap(api.POST('/api/assistant/chat-replies/', { body: { conversation_id: conversationId } }));
      return waitForJob<{ replies: string[] }>(job_id);
    },
  });
}

/** 5. Résumé du jour (préparé à la demande s'il n'existe pas encore). */
export function useDigest() {
  const { isAuthenticated } = useSession();
  return useQuery({
    queryKey: ['assistant', 'digest'],
    queryFn: async () => {
      const response = await unwrap(api.GET('/api/assistant/digest/'));
      if (response.digest || !response.job_id) return response.digest ?? null;
      const digest = await waitForJob<Digest | Record<string, never>>(response.job_id, SLOW);
      return 'headline' in digest ? digest : null;
    },
    enabled: isAuthenticated,
    staleTime: 60 * 60_000,
    retry: false,
    meta: { persist: false },
  });
}

/** 7. Coéquipiers proposés pour un projet (porteur seulement). */
export function useTeamSuggestions() {
  return useMutation({
    mutationFn: async (projectId: string) => {
      const { job_id } = await unwrap(api.POST('/api/assistant/team/', { body: { project_id: projectId } }));
      return waitForJob<{ candidates: TeamCandidate[]; invitation: string }>(job_id, SLOW);
    },
  });
}

export function useInviteTeammate() {
  return useMutation({
    mutationFn: (body: { project_id: string; username: string; message: string }) =>
      unwrap(api.POST('/api/assistant/team/invite/', { body })),
  });
}

/** 8. Recherche dictée : transcription puis requête structurée. */
export function useVoiceSearch() {
  return useMutation({
    mutationFn: async (input: { mediaId: string; language?: string }) => {
      const { job_id } = await unwrap(
        api.POST('/api/assistant/voice-search/', { body: { media_id: input.mediaId, language: input.language ?? null } }),
      );
      return waitForJob<{ text: string; query: string; scope: string; filters: Record<string, string> }>(job_id, SLOW);
    },
  });
}
