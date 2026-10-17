'use client';

import { keepPreviousData, type QueryKey, useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import type { Page } from './useInfiniteList';

function cursorOf(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  return new URL(url).searchParams.get('cursor') ?? undefined;
}

/**
 * Liste paginée page par page (tableaux du back-office) : Précédent / Suivant sur la pagination
 * par curseur de l'API. Revient à la page 1 quand les filtres (la clé) changent.
 */
export function usePagedList<T>(
  queryKey: QueryKey,
  fetchPage: (cursor: string | undefined) => Promise<Page<T>>,
  options: { persist?: boolean } = {},
) {
  const keyString = JSON.stringify(queryKey);
  const [state, setState] = useState<{ key: string; cursors: (string | undefined)[] }>({ key: keyString, cursors: [undefined] });
  // Nouveaux filtres : retour à la première page (ajusté pendant le rendu, sans effet).
  const cursors = state.key === keyString ? state.cursors : [undefined];
  if (state.key !== keyString) setState({ key: keyString, cursors: [undefined] });

  const cursor = cursors[cursors.length - 1];
  const query = useQuery({
    queryKey: [...queryKey, 'page', cursor ?? ''],
    queryFn: () => fetchPage(cursor),
    placeholderData: keepPreviousData,
    meta: options.persist === false ? { persist: false } : undefined,
  });
  const next = cursorOf(query.data?.next);

  return {
    ...query,
    items: query.data?.results ?? [],
    page: cursors.length,
    hasNext: Boolean(next),
    hasPrevious: cursors.length > 1,
    goNext: () => {
      if (next) setState({ key: keyString, cursors: [...cursors, next] });
    },
    goPrevious: () => setState({ key: keyString, cursors: cursors.slice(0, -1) }),
  };
}
