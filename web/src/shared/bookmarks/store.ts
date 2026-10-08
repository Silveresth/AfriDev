'use client';

import { useSyncExternalStore } from 'react';

/**
 * Anciens marque-pages enregistrés sur l'appareil (localStorage), avant les collections
 * synchronisées : lus une dernière fois pour être importés, puis effacés.
 */
export interface BookmarkEntry {
  id: string;
  type: 'post' | 'question' | 'snippet';
  title: string;
  href: string;
  savedAt: string;
}

const KEY = 'afridev.bookmarks';
const EVENT = 'afridev:bookmarks';
const EMPTY: BookmarkEntry[] = [];

// Instantané stable tant que la valeur brute ne change pas (exigé par useSyncExternalStore).
let cachedRaw: string | null = null;
let cachedList: BookmarkEntry[] = EMPTY;

function read(): BookmarkEntry[] {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {
    return EMPTY;
  }
  if (raw === cachedRaw) return cachedList;
  cachedRaw = raw;
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    cachedList = Array.isArray(parsed) ? (parsed as BookmarkEntry[]) : EMPTY;
  } catch {
    cachedList = EMPTY;
  }
  return cachedList;
}

function write(list: BookmarkEntry[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // stockage plein ou indisponible : le marque-page ne survivra pas à la page
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(callback: () => void) {
  const onStorage = (event: StorageEvent) => event.key === KEY && callback();
  window.addEventListener('storage', onStorage);
  window.addEventListener(EVENT, callback);
  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener(EVENT, callback);
  };
}

export function useBookmarks(): BookmarkEntry[] {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

export function clearLocalBookmarks() {
  write([]);
}
