'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';

const noopSubscribe = () => () => {};

/** false pendant le rendu serveur et l'hydratation, true ensuite. */
export function useIsClient(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

/** Valeur retardée (recherche pendant la frappe sans requête à chaque touche). */
export function useDebounced<T>(value: T, delay = 400): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

/** Préférence persistée localement (thème, mode texte…), sans casser le rendu serveur. */
export function useLocalPreference<T extends string>(key: string, fallback: T) {
  const read = () => {
    try {
      return (window.localStorage.getItem(key) as T | null) ?? fallback;
    } catch {
      return fallback;
    }
  };
  const value = useSyncExternalStore(
    (callback) => {
      const handler = (event: Event) => {
        if (!(event instanceof StorageEvent) || event.key === key) callback();
      };
      window.addEventListener('storage', handler);
      window.addEventListener('afridev:preference', handler);
      return () => {
        window.removeEventListener('storage', handler);
        window.removeEventListener('afridev:preference', handler);
      };
    },
    read,
    () => fallback,
  );
  const setValue = (next: T) => {
    try {
      window.localStorage.setItem(key, next);
    } catch {
      // stockage indisponible : la préférence ne vaut que pour cette page
    }
    window.dispatchEvent(new Event('afridev:preference'));
  };
  return [value, setValue] as const;
}
