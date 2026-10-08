import 'server-only';

import { API_URL } from './config';

/**
 * Lecture publique côté serveur (composants serveur, SEO), avec cache ISR.
 * Renvoie null si la ressource n'existe pas ou si l'API est injoignable :
 * la page bascule alors sur sa version client (cache local).
 */
export async function serverGet<T>(path: string, revalidate = 60): Promise<T | null> {
  try {
    const response = await fetch(`${API_URL}${path}`, { next: { revalidate } });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}
