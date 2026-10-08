'use client';

import { type QueryKey, useInfiniteQuery } from '@tanstack/react-query';

/** Page renvoyée par la pagination par curseur du backend. */
export interface Page<T> {
  next?: string | null;
  previous?: string | null;
  results: T[];
}

function cursorOf(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  return new URL(url).searchParams.get('cursor') ?? undefined;
}

/** Liste paginée par curseur, mise en cache localement (défilement « Charger plus »). */
export function useInfiniteList<T>(
  queryKey: QueryKey,
  fetchPage: (cursor: string | undefined) => Promise<Page<T>>,
  /** persist: false : jamais écrit dans la copie locale (données sensibles du back-office). */
  options: { enabled?: boolean; persist?: boolean } = {},
) {
  const query = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }) => fetchPage(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => cursorOf(last.next),
    enabled: options.enabled,
    meta: options.persist === false ? { persist: false } : undefined,
  });
  const items = query.data?.pages.flatMap((page) => page.results) ?? [];
  return { ...query, items };
}
