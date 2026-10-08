import createClient from 'openapi-fetch';

import type { paths } from './schema';

export interface ApiClientOptions {
  baseUrl: string;
  /** Renvoie le jeton d'accès courant (null si déconnecté). */
  getToken?: () => Promise<string | null> | string | null;
  /** fetch personnalisé (ex. renouvellement automatique du jeton sur 401). */
  fetch?: (request: Request) => Promise<Response>;
}

/** Client typé, généré depuis l'OpenAPI de Django. */
export function createApiClient({ baseUrl, getToken, fetch }: ApiClientOptions) {
  const client = createClient<paths>({ baseUrl, ...(fetch ? { fetch } : {}) });
  if (getToken) {
    client.use({
      async onRequest({ request }) {
        const token = await getToken();
        if (token) request.headers.set('Authorization', `Bearer ${token}`);
        return request;
      },
    });
  }
  return client;
}

export type ApiClient = ReturnType<typeof createApiClient>;
