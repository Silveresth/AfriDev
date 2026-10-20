import { COOKIE_SESSION, type Tokens } from '@afridev/api-client';

/**
 * Jetons de l'API sur le site :
 * - le jeton de renouvellement (30 jours) vit dans un cookie httpOnly posé par l'API : aucun
 *   script, même injecté par une faille XSS, ne peut le lire ;
 * - le jeton d'accès (30 min) reste en mémoire seulement, renouvelé au chargement de la page ;
 * - le stockage local ne garde qu'un indicateur « session ouverte », sans valeur secrète, pour
 *   savoir au démarrage (et dans les autres onglets) que l'on est connecté.
 */
const SESSION_FLAG = 'afridev.session';
// Anciennes versions du site : jetons en clair dans localStorage, migrés puis effacés.
const LEGACY_ACCESS_KEY = 'afridev.access';
const LEGACY_REFRESH_KEY = 'afridev.refresh';
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

// Jeton d'accès d'une ancienne session repris en mémoire une seule fois, puis effacé du disque.
let access: string | null = read(LEGACY_ACCESS_KEY);
if (access) write(LEGACY_ACCESS_KEY, null);

export const tokenStore = {
  get: () => access,
  /** Ancien jeton à migrer vers le cookie, sinon le marqueur de session en cookie. */
  getRefresh: () => read(LEGACY_REFRESH_KEY) ?? (read(SESSION_FLAG) ? COOKIE_SESSION : null),
  /** Connecté, d'après l'indicateur (sans attendre le renouvellement du jeton d'accès). */
  hasSession: () => Boolean(access || read(SESSION_FLAG) || read(LEGACY_REFRESH_KEY)),
  set(tokens: Tokens | null) {
    access = tokens?.access ?? null;
    // Le cookie est posé par l'API : l'éventuel ancien jeton en clair n'a plus lieu d'être.
    write(LEGACY_REFRESH_KEY, null);
    write(SESSION_FLAG, tokens ? '1' : null);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  },
  subscribe(callback: () => void) {
    const onStorage = (event: StorageEvent) => {
      if (event.key === SESSION_FLAG || event.key === LEGACY_REFRESH_KEY) {
        // Déconnexion depuis un autre onglet : le jeton en mémoire de celui-ci disparaît aussi.
        if (!read(SESSION_FLAG)) access = null;
        callback();
      }
    };
    window.addEventListener(CHANGE_EVENT, callback);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(CHANGE_EVENT, callback);
      window.removeEventListener('storage', onStorage);
    };
  },
};
