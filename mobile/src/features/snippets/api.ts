import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api, type Schemas, unwrap } from '@/shared/api';
import { useInfiniteList } from '@/shared/query';

export type PublicSnippet = Schemas['PublicSnippet'];
export type SnippetComment = Schemas['SnippetComment'];
export type NewSnippet = Schemas['SnippetInputRequest'];

/** Langages proposés à la publication (l'éditeur accepte aussi une saisie libre). */
export const LANGUAGES = [
  'python',
  'javascript',
  'typescript',
  'java',
  'kotlin',
  'dart',
  'php',
  'go',
  'rust',
  'c',
  'cpp',
  'csharp',
  'swift',
  'ruby',
  'sql',
  'bash',
  'html',
  'css',
  'json',
  'yaml',
] as const;

export const snippetKeys = {
  all: ['snippets'] as const,
  detail: (id: string) => ['snippets', 'public', id] as const,
  hub: (hub: string) => ['snippets', 'public', 'hub', hub] as const,
  comments: (id: string) => ['snippets', 'comments', id] as const,
};

export function usePublicSnippet(id: string) {
  return useQuery({
    queryKey: snippetKeys.detail(id),
    queryFn: () => unwrap(api.GET('/api/snippets/public/{snippet_id}/', { params: { path: { snippet_id: id } } })),
    enabled: Boolean(id),
  });
}

export function useSnippetsByHub(hub: string, enabled = true) {
  return useInfiniteList(
    snippetKeys.hub(hub),
    (cursor) => unwrap(api.GET('/api/snippets/public/', { params: { query: { cursor, hub } } })),
    { enabled },
  );
}

/** Publication depuis l'appli : public par défaut, rattaché au hub d'où l'on publie. */
export function useCreateSnippet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: NewSnippet) => unwrap(api.POST('/api/snippets/', { body })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: snippetKeys.all }),
  });
}

/** Suppression par l'auteur, ou par un modérateur du hub (snippet public). */
export function useDeleteSnippet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      unwrap(api.DELETE('/api/snippets/public/{snippet_id}/', { params: { path: { snippet_id: id } } })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: snippetKeys.all }),
  });
}

export function useSnippetComments(id: string) {
  return useInfiniteList(snippetKeys.comments(id), (cursor) =>
    unwrap(api.GET('/api/snippets/{snippet_id}/comments/', { params: { path: { snippet_id: id }, query: { cursor } } })),
  );
}

export function useAddSnippetComment(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: string) =>
      unwrap(api.POST('/api/snippets/{snippet_id}/comments/', { params: { path: { snippet_id: id } }, body: { body } })),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: snippetKeys.comments(id) });
      void queryClient.invalidateQueries({ queryKey: snippetKeys.detail(id) });
    },
  });
}
