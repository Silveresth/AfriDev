'use client';

import { del, get, set } from 'idb-keyval';
import { useCallback, useEffect, useRef, useState } from 'react';

const AUTOSAVE_INTERVAL_MS = 2_000;
const key = (id: string) => `draft:${id}`;

function isEmpty(value: unknown): boolean {
  if (typeof value === 'string') return !value.trim();
  if (value && typeof value === 'object') return Object.values(value).every(isEmpty);
  return value === undefined || value === null || value === false;
}

/**
 * Anti-coupure (module 5) : le brouillon est enregistré dans IndexedDB toutes les 2 s
 * s'il a changé, et restauré à la réouverture de l'écran (même après une coupure de courant).
 */
export function useAutosaveDraft<T>(draftId: string, value: T, onRestore?: (draft: T) => void) {
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const latest = useRef(value);
  // Valeur de départ (formulaire vierge) : jamais enregistrée comme brouillon.
  const pristine = useRef(JSON.stringify(value));
  const lastSaved = useRef<string>('');
  const restore = useRef(onRestore);
  useEffect(() => {
    latest.current = value;
    restore.current = onRestore;
  });

  useEffect(() => {
    let cancelled = false;
    void get<T>(key(draftId)).then((draft) => {
      if (cancelled || draft === undefined || isEmpty(draft)) return;
      lastSaved.current = JSON.stringify(draft);
      restore.current?.(draft);
    });
    const timer = window.setInterval(() => {
      const serialized = JSON.stringify(latest.current);
      if (serialized === lastSaved.current) return;
      lastSaved.current = serialized;
      if (serialized === pristine.current || isEmpty(latest.current)) void del(key(draftId));
      else void set(key(draftId), latest.current).then(() => setSavedAt(new Date()));
    }, AUTOSAVE_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [draftId]);

  const clear = useCallback(async () => {
    lastSaved.current = '';
    setSavedAt(null);
    await del(key(draftId));
  }, [draftId]);

  return { savedAt, clear };
}
