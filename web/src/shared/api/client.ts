import { createAfriDevClient } from '@afridev/api-client';

import { API_URL } from './config';
import { tokenStore } from './token';

/** Client commun web / mobile (packages/api-client), jetons gardés dans localStorage. */
const client = createAfriDevClient({ baseUrl: API_URL, tokens: tokenStore });

export const { api, authFetch, unwrap, apiFetch, waitForJob } = client;
