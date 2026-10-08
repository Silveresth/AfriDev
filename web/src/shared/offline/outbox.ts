'use client';

import { get, set } from 'idb-keyval';

import { API_URL, ApiError, authFetch, tokenStore } from '@/shared/api';

/**
 * File d'envoi hors ligne.
 * Une écriture faite sans réseau est gardée dans IndexedDB avec un UUID généré ici,
 * puis rejouée via POST /api/sync/upload/ dès le retour du réseau. Le backend ignore
 * un envoi déjà reçu (même UUID) : rejouer la file après une coupure est sans danger.
 * Les envois refusés (secret détecté, droits…) apparaissent dans Réglages > Envois en échec.
 */

export type OutboxTable = 'posts' | 'comments' | 'questions' | 'answers' | 'snippets' | 'projects';

export interface OutboxEntry {
  id: string;
  op: 'PUT' | 'PATCH' | 'DELETE';
  type: OutboxTable;
  data: Record<string, unknown>;
  createdAt: string;
  /** Libellé lisible : « Post : Bonjour Lomé… ». */
  label: string;
}

const STORAGE_KEY = 'afridev.outbox';
const RETRY_EVERY_MS = 30_000;

let entries: OutboxEntry[] = [];
let loaded = false;
let flushing: Promise<void> | null = null;
const listeners = new Set<() => void>();
const flushListeners = new Set<(result: FlushResult) => void>();

export interface FlushResult {
  sent: number;
  rejected: number;
}

function emit() {
  for (const listener of listeners) listener();
}

async function persist() {
  await set(STORAGE_KEY, entries);
  emit();
}

async function load() {
  if (loaded) return;
  entries = (await get<OutboxEntry[]>(STORAGE_KEY)) ?? [];
  loaded = true;
  emit();
}

export async function enqueue(entry: Omit<OutboxEntry, 'createdAt'>): Promise<OutboxEntry> {
  await load();
  const full: OutboxEntry = { ...entry, createdAt: new Date().toISOString() };
  entries = [...entries, full];
  await persist();
  void flushOutbox();
  return full;
}

/** Abandonne un envoi en attente (l'utilisateur ne veut plus l'envoyer). */
export async function removeFromOutbox(id: string): Promise<void> {
  await load();
  entries = entries.filter((entry) => entry.id !== id);
  await persist();
}

export function flushOutbox(): Promise<void> {
  flushing ??= (async () => {
    try {
      await load();
      if (!entries.length || !navigator.onLine || !tokenStore.get()) return;
      const batch = entries;
      const response = await authFetch(
        new Request(`${API_URL}/api/sync/upload/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            operations: batch.map((entry, index) => ({
              op_id: index + 1,
              op: entry.op,
              type: entry.type,
              id: entry.id,
              data: entry.data,
            })),
          }),
        }),
      );
      if (!response.ok) return; // erreur serveur temporaire : nouvel essai plus tard
      const result = (await response.json()) as { applied: number; rejected: unknown[] };
      const sent = new Set(batch);
      entries = entries.filter((entry) => !sent.has(entry));
      await persist();
      for (const listener of flushListeners) {
        listener({ sent: result.applied, rejected: result.rejected.length });
      }
    } catch (error) {
      if (!(error instanceof ApiError && error.isNetwork)) console.warn('Envoi différé échoué', error);
    } finally {
      flushing = null;
    }
  })();
  return flushing;
}

export const outboxStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    void load();
    return () => {
      listeners.delete(listener);
    };
  },
  getSnapshot: () => entries,
  onFlushed(listener: (result: FlushResult) => void) {
    flushListeners.add(listener);
    return () => {
      flushListeners.delete(listener);
    };
  },
};

/** Relance l'envoi au retour du réseau, au démarrage et périodiquement. */
export function startOutboxSync(): () => void {
  const flush = () => void flushOutbox();
  window.addEventListener('online', flush);
  const timer = window.setInterval(flush, RETRY_EVERY_MS);
  flush();
  return () => {
    window.removeEventListener('online', flush);
    window.clearInterval(timer);
  };
}
