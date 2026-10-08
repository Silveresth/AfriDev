'use client';

import type { Schemas } from '@afridev/api-client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api, unwrap } from '@/shared/api';
import { sendOrQueue, useLocalQuery } from '@/shared/offline';
import { useInfiniteList } from '@/shared/query';

export type Snippet = Schemas['SnippetOutput'];
export type PublicSnippet = Schemas['PublicSnippet'];

export const snippetKeys = {
  all: ['snippets'] as const,
  mine: ['snippets', 'mine'] as const,
  detail: (id: string) => ['snippets', 'mine', id] as const,
  versions: (id: string) => ['snippets', 'mine', id, 'versions'] as const,
  public: (id: string) => ['snippets', 'public', id] as const,
  byAuthor: (authorId: string) => ['snippets', 'public', 'author', authorId] as const,
  byHub: (hub: string) => ['snippets', 'public', 'hub', hub] as const,
};

export const LANGUAGES = [
  'python', 'javascript', 'typescript', 'php', 'go', 'java', 'kotlin', 'dart', 'rust', 'c', 'cpp',
  'csharp', 'ruby', 'swift', 'sql', 'bash', 'dockerfile', 'yaml', 'json', 'html', 'css', 'text',
];

interface LocalSnippetRow {
  id: string;
  title: string;
  language: string;
  content: string;
  tags: string | null;
  is_public: number;
  created_at: string;
  updated_at: string;
}

function fromLocal(row: LocalSnippetRow): Snippet {
  let tags: string[] = [];
  try {
    tags = JSON.parse(row.tags ?? '[]') as string[];
  } catch {
    tags = [];
  }
  return {
    id: row.id,
    title: row.title,
    language: row.language,
    content: row.content,
    tags,
    is_public: Boolean(row.is_public),
    published_at: null,
    ai_review: {},
    created_at: row.created_at,
    updated_at: row.updated_at,
  } as Snippet;
}

/**
 * Mon coffre : la copie SQLite PowerSync si elle est active (100 % hors ligne),
 * sinon l'API avec son cache local.
 */
export function useMySnippets() {
  const local = useLocalQuery<LocalSnippetRow>('SELECT * FROM snippets ORDER BY updated_at DESC');
  const remote = useInfiniteList(snippetKeys.mine, (cursor) =>
    unwrap(api.GET('/api/snippets/', { params: { query: { cursor } } })),
    { enabled: local === null },
  );
  if (local) {
    return { items: local.map(fromLocal), isPending: false, isError: false, source: 'local' as const, remote };
  }
  return { items: remote.items, isPending: remote.isPending, isError: remote.isError, source: 'api' as const, remote };
}

/** Snippet de mon coffre (version complète, modifiable). */
export function useSnippet(id: string | undefined) {
  return useQuery({
    queryKey: snippetKeys.detail(id ?? ''),
    queryFn: () => unwrap(api.GET('/api/snippets/{snippet_id}/', { params: { path: { snippet_id: id ?? '' } } })),
    enabled: Boolean(id),
  });
}

export function usePublicSnippet(id: string, initialData?: PublicSnippet) {
  return useQuery({
    queryKey: snippetKeys.public(id),
    queryFn: () => unwrap(api.GET('/api/snippets/public/{snippet_id}/', { params: { path: { snippet_id: id } } })),
    initialData,
  });
}

export function useSnippetsByAuthor(authorId: string | undefined) {
  return useInfiniteList(
    snippetKeys.byAuthor(authorId ?? ''),
    (cursor) => unwrap(api.GET('/api/snippets/public/', { params: { query: { cursor, author: authorId } } })),
    { enabled: Boolean(authorId) },
  );
}

export function useSnippetsByHub(hub: string) {
  return useInfiniteList(snippetKeys.byHub(hub), (cursor) =>
    unwrap(api.GET('/api/snippets/public/', { params: { query: { cursor, hub } } })),
  );
}

export function useVersions(id: string, enabled: boolean) {
  return useQuery({
    queryKey: snippetKeys.versions(id),
    queryFn: () => unwrap(api.GET('/api/snippets/{snippet_id}/versions/', { params: { path: { snippet_id: id } } })),
    enabled,
  });
}

export interface SnippetInput {
  title: string;
  language: string;
  content: string;
  tags: string[];
  is_public: boolean;
  /** Hub où partager le snippet une fois public (absent = inchangé). */
  hub_id?: string | null;
}

export function useSaveSnippet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: SnippetInput }) => {
      if (id) {
        // La visibilité se change par publier / dépublier (contrôle du Security Guard).
        const changes = {
          title: input.title,
          language: input.language,
          content: input.content,
          tags: input.tags,
          ...(input.hub_id !== undefined ? { hub_id: input.hub_id } : {}),
        };
        return sendOrQueue(
          () => unwrap(api.PATCH('/api/snippets/{snippet_id}/', { params: { path: { snippet_id: id } }, body: changes })),
          { id, op: 'PATCH', type: 'snippets', data: { ...input }, label: `Snippet : ${input.title}` },
        );
      }
      const newId = crypto.randomUUID();
      return sendOrQueue(
        () => unwrap(api.POST('/api/snippets/', { body: { id: newId, ...input } })),
        { id: newId, op: 'PUT', type: 'snippets', data: { ...input }, label: `Snippet : ${input.title}` },
      );
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: snippetKeys.all }),
  });
}

export function useSnippetActions() {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: snippetKeys.all });
  const publish = useMutation({
    mutationFn: ({ id, value }: { id: string; value: boolean }) =>
      unwrap(
        value
          ? api.POST('/api/snippets/{snippet_id}/publish/', { params: { path: { snippet_id: id } } })
          : api.POST('/api/snippets/{snippet_id}/unpublish/', { params: { path: { snippet_id: id } } }),
      ),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: (id: string) =>
      sendOrQueue(
        () => unwrap(api.DELETE('/api/snippets/{snippet_id}/', { params: { path: { snippet_id: id } } })),
        { id, op: 'DELETE', type: 'snippets', data: {}, label: 'Suppression de snippet' },
      ),
    onSuccess: refresh,
  });
  return { publish, remove };
}
