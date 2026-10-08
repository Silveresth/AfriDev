import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ApiError, tokenStore } from '@/shared/api';
import { AnimatedSplash } from '@/shared/brand';
import { DataSaverProvider } from '@/shared/data-saver';
import { LangProvider } from '@/shared/i18n';
import { SessionProvider, useSession } from '@/shared/session';
import { ThemeProvider, useTheme } from '@/shared/theme';
import { ToastProvider } from '@/shared/ui';

void SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // Erreur métier (4xx) : aucun nouvel essai. Réseau coupé : un seul, pour vite expliquer quoi faire.
      retry: (count, error) => {
        if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
        if (error instanceof ApiError && error.isNetwork) return count < 1;
        return count < 2;
      },
    },
  },
});

const MODAL = { presentation: 'modal', animation: 'slide_from_bottom' } as const;

/**
 * L'appli n'est accessible qu'une fois connecté : sans session, seul l'écran de connexion existe.
 * Se connecter (ou se déconnecter, ou voir sa session expirer) bascule de lui-même d'un monde à l'autre.
 */
function Navigator() {
  const { colors, isDark } = useTheme();
  const { isAuthenticated } = useSession();
  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} animated />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: 'slide_from_right',
          gestureEnabled: true,
          fullScreenGestureEnabled: true,
        }}
      >
        <Stack.Protected guard={isAuthenticated}>
          <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
          <Stack.Screen name="compose/post" options={MODAL} />
          <Stack.Screen name="compose/question" options={MODAL} />
          <Stack.Screen name="edit-profile" options={MODAL} />
          <Stack.Screen name="post/[id]" />
          <Stack.Screen name="question/[id]" />
          <Stack.Screen name="h/[slug]" />
          <Stack.Screen name="u/[username]" />
          <Stack.Screen name="notifications" />
          <Stack.Screen name="settings/index" />
          <Stack.Screen name="settings/security" />
          <Stack.Screen name="settings/notifications" />
          <Stack.Screen name="settings/privacy" />
          <Stack.Screen name="settings/language" />
        </Stack.Protected>
        <Stack.Protected guard={!isAuthenticated}>
          <Stack.Screen name="login" options={{ animation: 'fade' }} />
        </Stack.Protected>
        <Stack.Screen name="index" />
        <Stack.Screen name="oauth" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const [splashDone, setSplashDone] = useState(false);

  useEffect(() => {
    void tokenStore.hydrate().finally(() => setReady(true));
  }, []);

  // Le splash animé reprend exactement l'image du splash natif : on cache ce dernier dès qu'il est peint.
  const onSplashLayout = useCallback(() => void SplashScreen.hideAsync(), []);

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <LangProvider>
        <ThemeProvider>
          <DataSaverProvider>
            {ready ? (
              <SessionProvider>
                <ToastProvider>
                  <Navigator />
                </ToastProvider>
              </SessionProvider>
            ) : null}
            {splashDone ? null : (
              <AnimatedSplash ready={ready} onFinish={() => setSplashDone(true)} onLayout={onSplashLayout} />
            )}
          </DataSaverProvider>
        </ThemeProvider>
        </LangProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
