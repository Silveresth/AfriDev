import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { api, type Schemas, unwrap } from '@/shared/api';
import { t } from '@/shared/i18n';
import { ME_KEY } from '@/shared/session';

export type DeviceSession = Schemas['Session'];
export type AccessToken = Schemas['AccessToken'];
export type NotificationPreferences = Schemas['Preferences'];

const keys = {
  sessions: ['settings', 'sessions'] as const,
  tokens: ['settings', 'tokens'] as const,
  notifications: ['settings', 'notifications'] as const,
};

// ── Sécurité ──

export function useSessions() {
  return useQuery({ queryKey: keys.sessions, queryFn: () => unwrap(api.GET('/api/accounts/sessions/')) });
}

export function useSessionActions() {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: keys.sessions });
  const revoke = useMutation({
    mutationFn: (id: string) => unwrap(api.DELETE('/api/accounts/sessions/{session_id}/', { params: { path: { session_id: id } } })),
    onSuccess: refresh,
  });
  const revokeOthers = useMutation({
    mutationFn: () => unwrap(api.POST('/api/accounts/sessions/revoke-others/')),
    onSuccess: refresh,
  });
  return { revoke, revokeOthers };
}

export function useTwoFactor() {
  const queryClient = useQueryClient();
  const onUser = (user: Schemas['User']) => queryClient.setQueryData(ME_KEY, user);
  const setup = useMutation({ mutationFn: () => unwrap(api.POST('/api/accounts/2fa/setup/')) });
  const enable = useMutation({
    mutationFn: (code: string) => unwrap(api.POST('/api/accounts/2fa/enable/', { body: { code } })),
    onSuccess: onUser,
  });
  const disable = useMutation({
    mutationFn: (code: string) => unwrap(api.POST('/api/accounts/2fa/disable/', { body: { code } })),
    onSuccess: onUser,
  });
  return { setup, enable, disable };
}

// ── Notifications ──

export function useNotificationPreferences() {
  return useQuery({ queryKey: keys.notifications, queryFn: () => unwrap(api.GET('/api/notifications/preferences/')) });
}

export function useUpdateNotificationPreferences() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: Schemas['PatchedPreferencesUpdateRequest']) => unwrap(api.PATCH('/api/notifications/preferences/', { body })),
    // Interrupteur basculé tout de suite, corrigé par la réponse.
    onMutate: (changes) => {
      const previous = queryClient.getQueryData<NotificationPreferences>(keys.notifications);
      if (previous) queryClient.setQueryData(keys.notifications, { ...previous, ...changes });
      return { previous };
    },
    onError: (_error, _changes, context) => {
      if (context?.previous) queryClient.setQueryData(keys.notifications, context.previous);
    },
    onSuccess: (prefs) => queryClient.setQueryData(keys.notifications, prefs),
  });
}

// ── Confidentialité ──

export function useAccessTokens() {
  return useQuery({ queryKey: keys.tokens, queryFn: () => unwrap(api.GET('/api/accounts/tokens/')) });
}

export function useAccessTokenActions() {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: keys.tokens });
  const create = useMutation({
    mutationFn: (body: Schemas['AccessTokenInputRequest']) => unwrap(api.POST('/api/accounts/tokens/', { body })),
    onSuccess: refresh,
  });
  const revoke = useMutation({
    mutationFn: (id: string) => unwrap(api.DELETE('/api/accounts/tokens/{token_id}/', { params: { path: { token_id: id } } })),
    onSuccess: refresh,
  });
  return { create, revoke };
}

/** Archive JSON de toutes mes données (RGPD) : écrite dans le cache puis partagée (Drive, e-mail…). */
export async function exportMyData(username: string) {
  const data = await unwrap(api.GET('/api/accounts/me/export/'));
  const date = new Date().toISOString().slice(0, 10);
  const file = new File(Paths.cache, `afridev-${username}-${date}.json`);
  if (file.exists) file.delete();
  file.create();
  file.write(JSON.stringify(data, null, 2));
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: t('priv.export') });
  }
  return file.uri;
}
