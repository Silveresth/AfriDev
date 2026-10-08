'use client';

import type { Schemas } from '@afridev/api-client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api, unwrap } from '@/shared/api';
import { sendOrQueue } from '@/shared/offline';
import { useInfiniteList } from '@/shared/query';

export type Project = Schemas['ProjectOutput'];
export type Issue = Schemas['Issue'];

export interface ProjectFilters {
  tag?: string;
  owner?: string;
  recruiting?: boolean;
  q?: string;
}

export const projectKeys = {
  all: ['projects'] as const,
  list: (filters: ProjectFilters) => ['projects', 'list', filters] as const,
  detail: (id: string) => ['projects', 'detail', id] as const,
  issues: (id: string) => ['projects', 'detail', id, 'issues'] as const,
};

export function useProjects(filters: ProjectFilters = {}) {
  return useInfiniteList(projectKeys.list(filters), (cursor) =>
    unwrap(api.GET('/api/projects/', { params: { query: { cursor, ...filters } } })),
  );
}

export function useProject(id: string | undefined, initialData?: Project) {
  return useQuery({
    queryKey: projectKeys.detail(id ?? ''),
    queryFn: () => unwrap(api.GET('/api/projects/{project_id}/', { params: { path: { project_id: id ?? '' } } })),
    initialData,
    enabled: Boolean(id),
  });
}

export function useIssues(id: string) {
  return useQuery({
    queryKey: projectKeys.issues(id),
    queryFn: () => unwrap(api.GET('/api/projects/{project_id}/issues/', { params: { path: { project_id: id } } })),
  });
}

export interface ProjectInput {
  name: string;
  description: string;
  repo_url: string;
  tags: string[];
  is_recruiting: boolean;
}

export function useSaveProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: ProjectInput }) => {
      if (id) {
        return unwrap(api.PATCH('/api/projects/{project_id}/', { params: { path: { project_id: id } }, body: input })).then(
          (result) => ({ queued: false as const, result }),
        );
      }
      const newId = crypto.randomUUID();
      return sendOrQueue(() => unwrap(api.POST('/api/projects/', { body: { id: newId, ...input } })), {
        id: newId,
        op: 'PUT',
        type: 'projects',
        data: { ...input },
        label: `Projet : ${input.name}`,
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: projectKeys.all }),
  });
}

export function useProjectActions(id: string) {
  const queryClient = useQueryClient();
  const sync = useMutation({
    mutationFn: () => unwrap(api.POST('/api/projects/{project_id}/sync/', { params: { path: { project_id: id } } })),
    onSuccess: () => {
      // L'import GitHub tourne en tâche de fond : on rafraîchit un peu plus tard.
      window.setTimeout(() => void queryClient.invalidateQueries({ queryKey: projectKeys.detail(id) }), 4000);
    },
  });
  const remove = useMutation({
    mutationFn: () => unwrap(api.DELETE('/api/projects/{project_id}/', { params: { path: { project_id: id } } })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: projectKeys.all }),
  });
  return { sync, remove };
}
