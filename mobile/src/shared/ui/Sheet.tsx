import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { t } from '@/shared/i18n';
import { radius, useTheme } from '@/shared/theme';

import { Text } from './Text';

/**
 * Feuille qui monte du bas (glissement court) sur un voile qui s'assombrit ; à la fermeture elle
 * redescend avant de disparaître. Un toucher sur le voile la ferme.
 */
export function Sheet({
  visible,
  onClose,
  onHidden,
  title,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  /**
   * Feuille entièrement refermée (Modal démonté). C'est là qu'il faut naviguer : un écran
   * poussé pendant que le Modal est encore affiché s'ouvre derrière lui.
   */
  onHidden?: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [mounted, setMounted] = useState(visible);
  const progress = useSharedValue(0);
  const hiddenRef = useRef(onHidden);
  hiddenRef.current = onHidden;
  const visibleRef = useRef(visible);
  visibleRef.current = visible;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      progress.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) });
      return;
    }
    if (!mounted) return;
    // Le Modal est une fenêtre native au-dessus de toute l'appli : s'il restait monté (voile à
    // opacité 0), plus aucun bouton ne répondrait. Il est donc retiré dès la fin de l'animation,
    // même interrompue (navigation, appli en arrière-plan), et au plus tard par le minuteur.
    let finished = false;
    const hide = () => {
      if (finished || visibleRef.current) return;
      finished = true;
      setMounted(false);
      // Laisse le Modal natif se retirer avant de rendre la main.
      setTimeout(() => hiddenRef.current?.(), 0);
    };
    progress.value = withTiming(0, { duration: 220, easing: Easing.in(Easing.quad) }, () => runOnJS(hide)());
    const fallback = setTimeout(hide, 320);
    return () => clearTimeout(fallback);
  }, [mounted, progress, visible]);

  const scrim = useAnimatedStyle(() => ({ opacity: progress.value }));
  const sheet = useAnimatedStyle(() => ({ transform: [{ translateY: (1 - progress.value) * Math.min(height * 0.6, 480) }] }));

  if (!mounted) return null;
  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim }, scrim]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel={t('header.close')} />
      </Animated.View>
      <Animated.View style={[styles.sheet, { backgroundColor: colors.background, paddingBottom: insets.bottom + 12 }, sheet]}>
        <Animated.View style={[styles.grabber, { backgroundColor: colors.lineStrong }]} />
        {title ? (
          <Text variant="headline" style={styles.title}>
            {title}
          </Text>
        ) : null}
        {children}
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: radius.lg + 6,
    borderTopRightRadius: radius.lg + 6,
    paddingTop: 8,
  },
  grabber: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, marginBottom: 8 },
  title: { paddingHorizontal: 20, paddingVertical: 8 },
});
