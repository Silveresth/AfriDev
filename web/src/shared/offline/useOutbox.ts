'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useSyncExternalStore } from 'react';

import { ApiError } from '@/shared/api';

import { enqueue, type OutboxEntry, type OutboxTable, outboxStore, startOutboxSync } from './outbox';

const EMPTY: OutboxEntry[] = [];

/** Écritures en attente de réseau (optionnellement filtrées par table). */
export function useOutbox(type?: OutboxTable): OutboxEntry[] {
  const all = useSyncExternalStore(outboxStore.subscribe, outboxStore.getSnapshot, () => EMPTY);
  return type ? all.filter((entry) => entry.type === type) : all;
}

/** Démarre la file et rafraîchit les données affichées après chaque envoi réussi. */
export function OutboxSync() {
  const queryClient = useQueryClient();
  useEffect(() => startOutboxSync(), []);
  useEffect(
    () =>
      outboxStore.onFlushed(({ sent }) => {
        if (sent) void queryClient.invalidateQueries();
      }),
    [queryClient],
  );
  return null;
}

/**
 * Envoie tout de suite si le réseau répond ; sinon met l'écriture en file d'attente.
 * `entry.id` doit être l'UUID utilisé pour l'appel en ligne : un double envoi est ignoré.
 */
export async function sendOrQueue<T>(
  send: () => Promise<T>,
  entry: Omit<OutboxEntry, 'createdAt'>,
): Promise<{ queued: false; result: T } | { queued: true; entry: OutboxEntry }> {
  if (navigator.onLine) {
    try {
      return { queued: false, result: await send() };
    } catch (error) {
      if (!(error instanceof ApiError && error.isNetwork)) throw error;
    }
  }
  return { queued: true, entry: await enqueue(entry) };
}
