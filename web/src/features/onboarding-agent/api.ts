'use client';

import type { Schemas } from '@afridev/api-client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api, unwrap } from '@/shared/api';

export type Guide = Schemas['Guide'];

export const guideKeys = {
  detail: (id: string) => ['guides', id] as const,
  forProject: (projectId: string) => ['guides', 'project', projectId] as const,
};

export function useGuide(id: string | null) {
  return useQuery({
    queryKey: guideKeys.detail(id ?? ''),
    queryFn: () =>
      unwrap(api.GET('/api/onboarding-agent/guides/{guide_id}/', { params: { path: { guide_id: id ?? '' } } })),
    enabled: Boolean(id),
    // L'agent lit le dépôt puis rédige : on suit l'avancement sans recharger la page.
    refetchInterval: (query) => (query.state.data?.status === 'pending' ? 3000 : false),
  });
}

export function useProjectGuides(projectId: string) {
  return useQuery({
    queryKey: guideKeys.forProject(projectId),
    queryFn: () => unwrap(api.GET('/api/onboarding-agent/guides/', { params: { query: { project: projectId } } })),
  });
}

export function useRequestGuide() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { repo_url: string; project_id?: string }) =>
      unwrap(api.POST('/api/onboarding-agent/guides/', { body: input })),
    onSuccess: (guide) => queryClient.setQueryData(guideKeys.detail(guide.id), guide),
  });
}
