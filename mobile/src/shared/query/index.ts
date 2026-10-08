import { type QueryKey, useInfiniteQuery } from '@tanstack/react-query';

/** Page renvoyée par la pagination par curseur du backend. */
export interface Page<T> {
  next?: string | null;
  previous?: string | null;
  results: T[];
}

/** Extrait le curseur d'une URL « next » (sans URLSearchParams, partiel sous Hermes). */
function cursorOf(url: string | null | undefined): string | undefined {
  const match = url?.match(/[?&]cursor=([^&#]+)/);
  return match?.[1] ? decodeURIComponent(match[1]) : undefined;
}

/** Liste paginée par curseur : défilement infini + tirer pour rafraîchir. */
export function useInfiniteList<T>(
  queryKey: QueryKey,
  fetchPage: (cursor: string | undefined) => Promise<Page<T>>,
  options: { enabled?: boolean } = {},
) {
  const query = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }) => fetchPage(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => cursorOf(last.next),
    enabled: options.enabled,
  });
  const items = query.data?.pages.flatMap((page) => page.results) ?? [];
  const loadMore = () => {
    if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
  };
  return { ...query, items, loadMore };
}
