import { ApiError, createAfriDevClient, errorMessage as baseErrorMessage } from '@afridev/api-client';

import { API_URL, apiUnreachableHint } from './config';
import { tokenStore } from './token';

/** Client commun web / mobile (packages/api-client) : jeton renouvelé, 15 s maximum par requête. */
const client = createAfriDevClient({ baseUrl: API_URL || 'http://api-non-configuree.invalid', tokens: tokenStore, timeoutMs: 15_000 });

export const { api, unwrap, apiFetch } = client;

/** Comme le web, mais une coupure réseau explique quoi faire (adresse de l'API, mode tunnel). */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError && error.isNetwork) return apiUnreachableHint();
  return baseErrorMessage(error);
}

export { ApiError, type Schemas, type Tokens } from '@afridev/api-client';
export { absoluteUrl, API_URL, IS_EXPO_TUNNEL, PUBLIC_WEB_URL } from './config';
export { tokenStore } from './token';
