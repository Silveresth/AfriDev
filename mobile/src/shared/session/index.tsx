import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from 'react';

import { api, type Schemas, tokenStore, type Tokens, unwrap } from '@/shared/api';

type User = Schemas['User'];
type MyProfile = Schemas['MyProfile'];

interface Session {
  isAuthenticated: boolean;
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
  const isAuthenticated = useSyncExternalStore(tokenStore.subscribe, hasToken, hasToken);

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
    queryClient.clear();
  }, [queryClient]);

  const value = useMemo<Session>(
    () => ({ isAuthenticated, user: me.data, profile: profile.data, signIn, signOut }),
    [isAuthenticated, me.data, profile.data, signIn, signOut],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const session = useContext(SessionContext);
  if (!session) throw new Error('useSession doit être utilisé sous <SessionProvider>.');
  return session;
}

/** Enveloppe une action réservée aux membres : sinon, ouvre l'écran de connexion. */
export function useRequireAuth() {
  const { isAuthenticated } = useSession();
  return useCallback(
    (action: () => void) => {
      if (isAuthenticated) action();
      else router.push('/login');
    },
    [isAuthenticated],
  );
}
