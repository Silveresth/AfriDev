'use client';

import type { Schemas } from '@afridev/api-client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from 'react';

import { api, tokenStore, type Tokens, unwrap } from '@/shared/api';

type User = Schemas['User'];
type MyProfile = Schemas['MyProfile'];

interface Session {
  isAuthenticated: boolean;
  /** Vrai tant que la copie locale du profil n'est pas encore lue. */
  isLoading: boolean;
  user: User | undefined;
  profile: MyProfile | undefined;
  signIn: (tokens: Tokens) => void;
  signOut: () => void;
}

const SessionContext = createContext<Session | null>(null);

export const ME_KEY = ['session', 'me'] as const;
export const MY_PROFILE_KEY = ['session', 'profile'] as const;

const hasToken = () => Boolean(tokenStore.get() || tokenStore.getRefresh());

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const isAuthenticated = useSyncExternalStore(tokenStore.subscribe, hasToken, () => false);

  const me = useQuery({
    queryKey: ME_KEY,
    queryFn: () => unwrap(api.GET('/api/accounts/me/')),
    enabled: isAuthenticated,
    staleTime: 5 * 60_000,
  });
  const profile = useQuery({
    queryKey: MY_PROFILE_KEY,
    queryFn: () => unwrap(api.GET('/api/profiles/me/')),
    enabled: isAuthenticated,
    staleTime: 60_000,
  });

  const signIn = useCallback(
    (tokens: Tokens) => {
      queryClient.clear();
      tokenStore.set(tokens);
    },
    [queryClient],
  );

  const signOut = useCallback(() => {
    tokenStore.set(null);
    queryClient.clear(); // la copie locale contient des données personnelles
  }, [queryClient]);

  const value = useMemo<Session>(
    () => ({
      isAuthenticated,
      isLoading: isAuthenticated && (me.isPending || profile.isPending),
      user: me.data,
      profile: profile.data,
      signIn,
      signOut,
    }),
    [isAuthenticated, me.isPending, me.data, profile.isPending, profile.data, signIn, signOut],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const session = useContext(SessionContext);
  if (!session) throw new Error('useSession doit être utilisé sous <SessionProvider>.');
  return session;
}
