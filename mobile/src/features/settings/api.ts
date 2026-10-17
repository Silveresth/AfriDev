import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { api, type Schemas, unwrap } from '@/shared/api';
import { t } from '@/shared/i18n';

export type AccessToken = Schemas['AccessToken'];
export type NotificationPreferences = Schemas['Preferences'];

const keys = {
  tokens: ['settings', 'tokens'] as const,
  notifications: ['settings', 'notifications'] as const,
};

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

/** Suppression définitive du compte (RGPD, droit à l'effacement). */
export function useDeleteAccount() {
  return useMutation({
    mutationFn: (body: Schemas['DeleteAccountRequest']) => unwrap(api.POST('/api/accounts/me/delete/', { body })),
  });
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
