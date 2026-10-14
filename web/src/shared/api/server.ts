import 'server-only';

import { API_URL } from './config';

const BASE_URL = process.env.INTERNAL_API_URL || API_URL;

/**
 * Lecture publique côté serveur (composants serveur, SEO), avec cache ISR.
 * Renvoie null si la ressource n'existe pas ou si l'API est injoignable :
 * la page bascule alors sur sa version client (cache local).
 */
export async function serverGet<T>(path: string, revalidate = 60): Promise<T | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      next: { revalidate },
      signal: controller.signal,
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}
