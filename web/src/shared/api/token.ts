import type { Tokens } from '@afridev/api-client';

const ACCESS_KEY = 'afridev.access';
const REFRESH_KEY = 'afridev.refresh';
const CHANGE_EVENT = 'afridev:auth-change';

function read(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null) {
  try {
    if (value) window.localStorage.setItem(key, value);
    else window.localStorage.removeItem(key);
  } catch {
    // stockage indisponible (navigation privée stricte) : la session ne survivra pas au rechargement
  }
}

/** Jetons JWT de l'API. Un événement prévient l'appli de toute connexion / déconnexion. */
export const tokenStore = {
  get: () => read(ACCESS_KEY),
  getRefresh: () => read(REFRESH_KEY),
  set(tokens: Tokens | null) {
    write(ACCESS_KEY, tokens?.access ?? null);
    write(REFRESH_KEY, tokens?.refresh ?? null);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  },
  setAccess(access: string) {
    write(ACCESS_KEY, access);
  },
  subscribe(callback: () => void) {
    const onStorage = (event: StorageEvent) => {
      if (event.key === ACCESS_KEY || event.key === REFRESH_KEY) callback();
    };
    window.addEventListener(CHANGE_EVENT, callback);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(CHANGE_EVENT, callback);
      window.removeEventListener('storage', onStorage);
    };
  },
};
