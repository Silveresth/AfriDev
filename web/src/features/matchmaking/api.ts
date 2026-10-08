'use client';

import type { Schemas } from '@afridev/api-client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api, unwrap } from '@/shared/api';
import { useSession } from '@/shared/session';

export type ProjectRecommendation = Schemas['ProjectRecommendation'];
export type CandidateRecommendation = Schemas['CandidateRecommendation'];
export type Application = Schemas['Application'];

export const matchKeys = {
  all: ['matchmaking'] as const,
  projects: ['matchmaking', 'projects'] as const,
  candidates: (projectId: string) => ['matchmaking', 'candidates', projectId] as const,
  mine: ['matchmaking', 'applications', 'mine'] as const,
  forProject: (projectId: string) => ['matchmaking', 'applications', projectId] as const,
};

export function useRecommendedProjects() {
  const { isAuthenticated } = useSession();
  return useQuery({
    queryKey: matchKeys.projects,
    queryFn: () => unwrap(api.GET('/api/matchmaking/projects/')),
    enabled: isAuthenticated,
  });
}

export function useCandidates(projectId: string, enabled: boolean) {
  return useQuery({
    queryKey: matchKeys.candidates(projectId),
    queryFn: () =>
      unwrap(api.GET('/api/matchmaking/projects/{project_id}/candidates/', { params: { path: { project_id: projectId } } })),
    enabled,
  });
}

export function useMyApplications() {
  const { isAuthenticated } = useSession();
  return useQuery({
    queryKey: matchKeys.mine,
    queryFn: () => unwrap(api.GET('/api/matchmaking/applications/mine/')),
    enabled: isAuthenticated,
  });
}

export function useProjectApplications(projectId: string, enabled: boolean) {
  return useQuery({
    queryKey: matchKeys.forProject(projectId),
    queryFn: () =>
      unwrap(api.GET('/api/matchmaking/projects/{project_id}/applications/', { params: { path: { project_id: projectId } } })),
    enabled,
  });
}

export function useApply(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (message: string) =>
      unwrap(
        api.POST('/api/matchmaking/projects/{project_id}/apply/', {
          params: { path: { project_id: projectId } },
          body: { message },
        }),
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: matchKeys.all }),
  });
}

export function useAnswerApplication(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, accept }: { id: string; accept: boolean }) =>
      unwrap(
        api.POST('/api/matchmaking/applications/{application_id}/answer/', {
          params: { path: { application_id: id } },
          body: { accept },
        }),
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: matchKeys.forProject(projectId) }),
  });
}
