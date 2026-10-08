import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { t } from '@/shared/i18n';

/** Expo lancé avec --tunnel : le bundle passe par *.exp.direct, pas par le réseau local. */
const hostUri = Constants.expoConfig?.hostUri ?? '';
export const IS_EXPO_TUNNEL = /exp\.direct|ngrok/.test(hostUri);

/**
 * Adresse de l'API en développement, sans rien configurer :
 * - téléphone réel (Expo Go ou development build) : la machine qui sert Metro
 *   (« 192.168.x.x:8081 » → « http://192.168.x.x:8000 ») ;
 * - émulateur Android : 10.0.2.2 = la machine hôte ; web et simulateur iOS : localhost.
 * EXPO_PUBLIC_API_URL l'emporte toujours (production, `pnpm mobile:tunnel`, autre port).
 * En mode tunnel sans EXPO_PUBLIC_API_URL, aucune adresse locale n'est joignable.
 */
function devApiUrl(): string {
  const host = hostUri.split(':')[0];
  if (IS_EXPO_TUNNEL) return '';
  if (host && host !== 'localhost' && host !== '127.0.0.1') return `http://${host}:8000`;
  return Platform.OS === 'android' ? 'http://10.0.2.2:8000' : 'http://localhost:8000';
}

export const API_URL = (process.env.EXPO_PUBLIC_API_URL || devApiUrl()).replace(/\/$/, '');
/** URL publique du site web (liens partagés). */
export const PUBLIC_WEB_URL = process.env.EXPO_PUBLIC_WEB_URL ?? 'http://localhost:3000';

/** Message affiché quand l'API ne répond pas : dit quoi faire selon le mode de lancement. */
export const apiUnreachableHint = () => (!API_URL ? t('net.tunnel') : t('net.unreachable', { url: API_URL }));

/** L'API sert les fichiers en chemins relatifs (/media/…) : on les rend absolus. */
export function absoluteUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  return url.startsWith('/') ? `${API_URL}${url}` : url;
}
