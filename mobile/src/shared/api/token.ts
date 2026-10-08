import type { Tokens } from '@afridev/api-client';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const ACCESS_KEY = 'afridev.access';
const REFRESH_KEY = 'afridev.refresh';

/**
 * Jetons JWT : gardés chiffrés (Keychain / Keystore), recopiés en mémoire au démarrage
 * pour une lecture synchrone. Sur la cible web d'Expo, localStorage les remplace.
 */
let access: string | null = null;
let refresh: string | null = null;
const listeners = new Set<() => void>();

const isWeb = Platform.OS === 'web';

async function readSecure(key: string) {
  if (isWeb) return globalThis.localStorage?.getItem(key) ?? null;
  return SecureStore.getItemAsync(key);
}

async function writeSecure(key: string, value: string | null) {
  if (isWeb) {
    if (value) globalThis.localStorage?.setItem(key, value);
    else globalThis.localStorage?.removeItem(key);
    return;
  }
  if (value) await SecureStore.setItemAsync(key, value);
  else await SecureStore.deleteItemAsync(key);
}

export const tokenStore = {
  /** À appeler une fois au démarrage, avant d'afficher les écrans. */
  async hydrate() {
    try {
      [access, refresh] = await Promise.all([readSecure(ACCESS_KEY), readSecure(REFRESH_KEY)]);
    } catch {
      access = refresh = null; // trousseau illisible (restauration d'appareil) : nouvelle connexion
    }
    listeners.forEach((listener) => listener());
  },
  get: () => access,
  getRefresh: () => refresh,
  set(tokens: Tokens | null) {
    access = tokens?.access ?? null;
    refresh = tokens?.refresh ?? null;
    void writeSecure(ACCESS_KEY, access);
    void writeSecure(REFRESH_KEY, refresh);
    listeners.forEach((listener) => listener());
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
