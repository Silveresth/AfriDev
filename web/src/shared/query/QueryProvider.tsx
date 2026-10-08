'use client';

import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { QueryClient } from '@tanstack/react-query';
import { type Persister, PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { del, get, set } from 'idb-keyval';
import { useState } from 'react';

import { ApiError } from '@/shared/api';

const ONE_WEEK = 7 * 24 * 60 * 60 * 1000;
/** Changer cette valeur invalide les copies locales après un changement de format de l'API. */
const CACHE_VERSION = 'v1';

function makeClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // L'appli lit d'abord sa copie locale, puis rafraîchit en arrière-plan si le réseau répond.
        networkMode: 'offlineFirst',
        staleTime: 30_000,
        gcTime: ONE_WEEK,
        refetchOnWindowFocus: false,
        retry: (failures, error) =>
          failures < 2 && !(error instanceof ApiError && error.status >= 400 && error.status < 500),
      },
      mutations: { networkMode: 'always', retry: false },
    },
  });
}

// Côté serveur (rendu des pages publiques), rien n'est persisté.
const noopPersister: Persister = {
  persistClient: async () => {},
  restoreClient: async () => undefined,
  removeClient: async () => {},
};

const persister: Persister =
  typeof window === 'undefined'
    ? noopPersister
    : createAsyncStoragePersister({
        storage: { getItem: (key) => get(key), setItem: (key, value) => set(key, value), removeItem: del },
        key: 'afridev.query-cache',
        throttleTime: 2_000,
      });

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(makeClient);
  return (
    <PersistQueryClientProvider
      client={client}
      persistOptions={{
        persister,
        maxAge: ONE_WEEK,
        buster: CACHE_VERSION,
        dehydrateOptions: {
          // On ne garde que les lectures réussies (pas les erreurs, ni les requêtes en cours).
          shouldDehydrateQuery: (query) => query.state.status === 'success' && query.meta?.persist !== false,
        },
      }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}
