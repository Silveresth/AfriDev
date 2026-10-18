import * as Network from 'expo-network';
import { usePathname } from 'expo-router';
import { CloudOff, Wifi } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useT } from '@/shared/i18n';
import { radius, useTheme } from '@/shared/theme';
import { Text } from '@/shared/ui';

/** Durée d'affichage de la bannière. */
const DURATION = 5000;

/** Hors ligne : pas de réseau, ou réseau sans accès à Internet. */
export function useIsOffline() {
  const network = Network.useNetworkState();
  return network.isConnected === false || network.isInternetReachable === false;
}

/**
 * Bannière de 5 secondes en haut de l'écran : « Vous êtes en mode hors ligne » à chaque écran
 * ouvert sans réseau (et dès la perte du réseau), « De retour en ligne » quand il revient.
 */
export function OfflineBanner() {
  const { colors } = useTheme();
  const { t } = useT();
  const insets = useSafeAreaInsets();
  const offline = useIsOffline();
  const pathname = usePathname();
  const [popup, setPopup] = useState<'offline' | 'online' | null>(null);
  const [seen, setSeen] = useState<{ offline: boolean; pathname: string } | null>(null);
  if (seen?.offline !== offline || seen.pathname !== pathname) {
    setSeen({ offline, pathname });
    if (offline) setPopup('offline');
    else if (seen?.offline) setPopup('online');
  }

  useEffect(() => {
    if (!popup) return;
    const timer = setTimeout(() => setPopup(null), DURATION);
    return () => clearTimeout(timer);
  }, [popup, pathname]);

  if (!popup) return null;
  const isOffline = popup === 'offline';
  const Icon = isOffline ? CloudOff : Wifi;
  // Encre inversée sur fond « ink » ; blanc sur le vert, lisible dans les deux thèmes.
  const ink = isOffline ? colors.background : '#FFFFFF';
  return (
    <Animated.View
      key={`${popup}-${pathname}`}
      entering={FadeInUp.duration(220)}
      exiting={FadeOutUp.duration(220)}
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      style={[styles.banner, { top: insets.top + 8, backgroundColor: isOffline ? colors.ink : colors.secondary }]}
    >
      <Icon size={16} color={ink} />
      <Text variant="smallStrong" style={{ color: ink }}>
        {t(isOffline ? 'offline.banner' : 'offline.back')}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    zIndex: 1000,
    elevation: 8,
  },
});
