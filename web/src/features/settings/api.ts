'use client';

import type { Schemas } from '@afridev/api-client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api, unwrap } from '@/shared/api';
import { ME_KEY } from '@/shared/session';

export type DeviceSession = Schemas['Session'];
export type AccessToken = Schemas['AccessToken'];
export type NotificationPreferences = Schemas['Preferences'];

const keys = {
  sessions: ['settings', 'sessions'] as const,
  tokens: ['settings', 'tokens'] as const,
  notifications: ['settings', 'notifications'] as const,
};

// Données de sécurité : jamais écrites dans la copie locale (meta persist: false).
const PRIVATE = { persist: false };

export function useSessions() {
  return useQuery({ queryKey: keys.sessions, queryFn: () => unwrap(api.GET('/api/accounts/sessions/')), meta: PRIVATE });
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

export function useNotificationPreferences() {
  return useQuery({ queryKey: keys.notifications, queryFn: () => unwrap(api.GET('/api/notifications/preferences/')) });
}

export function useUpdateNotificationPreferences() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: Schemas['PatchedPreferencesUpdateRequest']) => unwrap(api.PATCH('/api/notifications/preferences/', { body })),
    onSuccess: (prefs) => queryClient.setQueryData(keys.notifications, prefs),
  });
}

export function useAccessTokens() {
  return useQuery({ queryKey: keys.tokens, queryFn: () => unwrap(api.GET('/api/accounts/tokens/')), meta: PRIVATE });
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

/** Télécharge toutes mes données (JSON) : RGPD, droit à la portabilité. */
export async function downloadMyData(username: string) {
  const data = await unwrap(api.GET('/api/accounts/me/export/'));
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `afridev-${username}-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}
