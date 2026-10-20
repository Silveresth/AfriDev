import { createAfriDevClient } from '@afridev/api-client';

import { API_URL } from './config';
import { tokenStore } from './token';

/** Client commun web / mobile (packages/api-client) ; session du site en cookie httpOnly. */
const client = createAfriDevClient({ baseUrl: API_URL, tokens: tokenStore, cookieSession: true });

export const { api, authFetch, unwrap, apiFetch, waitForJob, uploadDirect, getAccessToken, logout } = client;
