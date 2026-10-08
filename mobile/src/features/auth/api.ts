import { useQuery } from '@tanstack/react-query';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import { api, API_URL, ApiError, type Schemas, unwrap } from '@/shared/api';
import { t } from '@/shared/i18n';

export type AuthResponse = Schemas['AuthResponse'];
export type OAuthProvider = 'github' | 'google';

export const PROVIDER_LABELS: Record<OAuthProvider, string> = { github: 'GitHub', google: 'Google' };

/** Fournisseurs activés côté serveur (GITHUB_CLIENT_ID / GOOGLE_CLIENT_ID renseignés). */
export function useOAuthProviders() {
  return useQuery({
    queryKey: ['auth', 'providers'],
    queryFn: async () => (await unwrap(api.GET('/api/accounts/oauth/providers/'))).providers,
    staleTime: 10 * 60_000,
    retry: false,
  });
}

export class OAuthCancelled extends Error {}

/**
 * Connexion GitHub / Google dans le navigateur sécurisé du système :
 * appli → API /start → fournisseur → API /callback → retour appli (exp:// ou afridev://) avec le
 * code, échangé ensuite contre les jetons. Les identifiants OAuth restent sur le serveur.
 */
export async function signInWithProvider(provider: OAuthProvider): Promise<AuthResponse> {
  const returnUrl = Linking.createURL('oauth');
  const startUrl = `${API_URL}/api/accounts/oauth/${provider}/start/?return_to=${encodeURIComponent(returnUrl)}`;
  const result = await WebBrowser.openAuthSessionAsync(startUrl, returnUrl);
  if (result.type !== 'success') throw new OAuthCancelled();

  const params = Linking.parse(result.url).queryParams ?? {};
  const read = (key: string) => (typeof params[key] === 'string' ? (params[key] as string) : '');
  if (read('error')) {
    throw new ApiError(
      read('error') === 'access_denied' ? t('oauth.cancelled') : t('oauth.refused', { provider: PROVIDER_LABELS[provider], error: read('error') }),
      'oauth_failed',
      400,
    );
  }
  if (!read('code')) throw new ApiError(t('oauth.incomplete'), 'oauth_failed', 400);

  return unwrap(
    api.POST('/api/accounts/oauth/{provider}/', {
      params: { path: { provider } },
      body: { code: read('code'), redirect_uri: read('redirect_uri') || undefined },
    }),
  );
}

/** Force du mot de passe (0 à 4) : longueur, casse, chiffres, symboles. */
export function passwordStrength(password: string): number {
  if (!password) return 0;
  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password) && /[^A-Za-z0-9]/.test(password)) score += 1;
  return Math.min(score, 4);
}
