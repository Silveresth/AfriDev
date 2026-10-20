'use client';

import type { Schemas } from '@afridev/api-client';
import { useQuery } from '@tanstack/react-query';

import { api, API_URL, unwrap } from '@/shared/api';

export type AuthResponse = Schemas['AuthResponse'];
export type OAuthProvider = 'github' | 'gitlab' | 'google';
export type UsernameStatus = Schemas['UsernameStatus'];

const NONCE_KEY = 'afridev.oauth-nonce';
const NEXT_KEY = 'afridev.after-login';
const MFA_KEY = 'afridev.mfa';

export const authApi = {
  usernameStatus: (username: string) =>
    unwrap(api.GET('/api/accounts/username-status/', { params: { query: { username } } })),
  requestPasswordReset: (email: string) => unwrap(api.POST('/api/accounts/password/reset/', { body: { email } })),
  confirmPasswordReset: (uid: string, token: string, password: string) =>
    unwrap(api.POST('/api/accounts/password/reset/confirm/', { body: { uid, token, password } })),
  login: (identifier: string, password: string) =>
    unwrap(api.POST('/api/accounts/login/', { body: { identifier, password } })),
  register: (body: Schemas['RegisterInputRequest']) =>
    unwrap(api.POST('/api/accounts/register/', { body })),
  loginMfa: (mfa_token: string, code: string) =>
    unwrap(api.POST('/api/accounts/login/2fa/', { body: { mfa_token, code } })),
  oauth: (provider: OAuthProvider, code: string, redirect_uri: string) =>
    unwrap(
      api.POST('/api/accounts/oauth/{provider}/', {
        params: { path: { provider } },
        body: { code, redirect_uri },
      }),
    ),
};

/** Connexion en deux temps (double authentification) : jeton signé valable 5 minutes. */
export const pendingMfa = {
  get: (): { token: string; created: boolean } | null => {
    try {
      return JSON.parse(sessionStorage.getItem(MFA_KEY) ?? 'null');
    } catch {
      return null;
    }
  },
  set: (token: string, created: boolean) => sessionStorage.setItem(MFA_KEY, JSON.stringify({ token, created })),
  clear: () => sessionStorage.removeItem(MFA_KEY),
};

/**
 * Suite commune à toutes les méthodes de connexion : ouvre la session, ou, si la double
 * authentification est active, mémorise le défi et renvoie false (l'appelant redirige vers /verify-2fa).
 */
export function completeAuth(response: AuthResponse, signIn: (tokens: Schemas['Tokens']) => void): boolean {
  if (response.mfa_required && response.mfa_token) {
    pendingMfa.set(response.mfa_token, response.created);
    return false;
  }
  if (response.tokens) signIn(response.tokens);
  return Boolean(response.tokens);
}

/** Page où revenir après la connexion (paramètre ?next=, limité au site). */
export const afterLogin = {
  set: (next: string | null) => {
    if (
      next?.startsWith('/') &&
      !next.startsWith('//') &&
      !next.startsWith('/login') &&
      !next.startsWith('/oauth')
    ) {
      sessionStorage.setItem(NEXT_KEY, next);
    }
  },
  take: (): string => {
    const next = sessionStorage.getItem(NEXT_KEY) ?? '/';
    sessionStorage.removeItem(NEXT_KEY);
    return next && !next.startsWith('/login') ? next : '/';
  },
};

/** Fournisseurs réellement configurés côté serveur : on n'affiche que des boutons qui marchent. */
export function useOAuthProviders() {
  return useQuery({
    queryKey: ['auth', 'providers'],
    queryFn: async () => (await unwrap(api.GET('/api/accounts/oauth/providers/'))).providers as OAuthProvider[],
    staleTime: 10 * 60_000,
    retry: false,
    meta: { persist: false },
  });
}

/**
 * Connexion Google / GitHub : l'API redirige vers le fournisseur puis rebondit vers
 * /oauth/callback avec le code. Les identifiants OAuth restent sur le serveur ; le nonce,
 * gardé dans cet onglet, prouve au retour que la connexion a bien été lancée d'ici (anti-CSRF).
 */
export function startOAuth(provider: OAuthProvider) {
  const nonce = crypto.randomUUID();
  sessionStorage.setItem(NONCE_KEY, `${provider}:${nonce}`);
  const query = new URLSearchParams({ return_to: `${window.location.origin}/oauth/callback`, nonce });
  // Navigation vers l'API (autre origine en production), pas vers une page Next.js.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.assign(`${API_URL}/api/accounts/oauth/${provider}/start/?${query}`);
}

/** Vérifie le retour (nonce, fournisseur) ; renvoie de quoi échanger le code, ou null. */
export function consumeOAuthReturn(params: URLSearchParams): { provider: OAuthProvider; code: string; redirectUri: string } | null {
  const expected = sessionStorage.getItem(NONCE_KEY);
  sessionStorage.removeItem(NONCE_KEY);
  const provider = params.get('provider') as OAuthProvider | null;
  const code = params.get('code');
  const redirectUri = params.get('redirect_uri');
  if (!provider || !code || !redirectUri || expected !== `${provider}:${params.get('nonce')}`) return null;
  return { provider, code, redirectUri };
}
