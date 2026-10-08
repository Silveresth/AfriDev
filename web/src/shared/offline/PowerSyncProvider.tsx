'use client';

import type { PowerSyncDatabase } from '@powersync/web';
import { createContext, useContext, useEffect, useState } from 'react';

import { POWERSYNC_URL } from '@/shared/api';
import { useSession } from '@/shared/session';

import { BackendConnector } from './connector';

/**
 * Copie SQLite locale synchronisée par PowerSync (coffre de snippets).
 * Activée seulement si NEXT_PUBLIC_POWERSYNC_URL est défini et l'utilisateur connecté ;
 * le module (WebAssembly, ~1 Mo) n'est alors téléchargé qu'une fois, puis mis en cache.
 * Sans PowerSync, les écrans lisent l'API et son cache local (IndexedDB).
 */
interface LocalDb {
  db: PowerSyncDatabase | null;
  /** true dès qu'une première synchronisation complète a eu lieu (copie locale fiable). */
  ready: boolean;
}

const LocalDbContext = createContext<LocalDb>({ db: null, ready: false });

export function PowerSyncProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useSession();
  const [state, setState] = useState<LocalDb>({ db: null, ready: false });

  useEffect(() => {
    if (!POWERSYNC_URL || !isAuthenticated) return;
    let database: PowerSyncDatabase | null = null;
    let dispose: (() => void) | undefined;
    let cancelled = false;
    void (async () => {
      // Chargés à la demande : PowerSync (~50 Ko compressés + WebAssembly) ne pèse
      // que sur les appareils où la synchro SQLite est réellement activée.
      const [{ PowerSyncDatabase }, { AppSchema }] = await Promise.all([
        import('@powersync/web'),
        import('@afridev/sync-schema'),
      ]);
      if (cancelled) return;
      database = new PowerSyncDatabase({
        schema: AppSchema,
        database: { dbFilename: 'afridev.sqlite' },
      });
      await database.init();
      const update = () =>
        setState({ db: database, ready: Boolean(database?.currentStatus.hasSynced) });
      dispose = database.registerListener({ statusChanged: update });
      update();
      void database.connect(new BackendConnector());
    })();
    return () => {
      cancelled = true;
      dispose?.();
      void database?.disconnectAndClear();
      setState({ db: null, ready: false });
    };
  }, [isAuthenticated]);

  return <LocalDbContext.Provider value={state}>{children}</LocalDbContext.Provider>;
}

export const useLocalDb = () => useContext(LocalDbContext);

/** Requête SQL sur la copie locale, mise à jour à chaque changement (null si indisponible). */
export function useLocalQuery<T>(sql: string, params: unknown[] = []): T[] | null {
  const { db, ready } = useLocalDb();
  const [rows, setRows] = useState<T[] | null>(null);
  const key = JSON.stringify(params);

  useEffect(() => {
    if (!db || !ready) return;
    const controller = new AbortController();
    void (async () => {
      for await (const result of db.watch(sql, JSON.parse(key) as unknown[], {
        signal: controller.signal,
      })) {
        setRows((result.rows?._array ?? []) as T[]);
      }
    })();
    return () => controller.abort();
  }, [db, ready, sql, key]);

  // Copie locale indisponible (PowerSync désactivé ou première synchro en cours) : null.
  return db && ready ? rows : null;
}
