import { Moon, Sun } from 'lucide-react-native';
import { StyleSheet } from 'react-native';
import Animated, { ZoomIn, ZoomOut } from 'react-native-reanimated';

import { useT } from '@/shared/i18n';
import { haptic, PressableScale } from '@/shared/motion';
import { useTheme } from '@/shared/theme';

/** Bascule clair / sombre : l'icône pivote, l'écran se recolore en « encre » depuis le doigt. */
export function ThemeToggle() {
  const { colors, isDark, setPreference } = useTheme();
  const { t } = useT();
  const Icon = isDark ? Sun : Moon;
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={t(isDark ? 'nav.theme_to_light' : 'nav.theme_to_dark')}
      scaleTo={0.85}
      hitSlop={6}
      onPress={(event) => {
        haptic.tap();
        setPreference(isDark ? 'light' : 'dark', { x: event.nativeEvent.pageX, y: event.nativeEvent.pageY });
      }}
      style={styles.button}
    >
      <Animated.View key={isDark ? 'sun' : 'moon'} entering={ZoomIn.springify().damping(10).withInitialValues({ transform: [{ rotate: '-90deg' }, { scale: 0 }] })} exiting={ZoomOut.duration(120)}>
        <Icon size={22} color={colors.ink} strokeWidth={2} />
      </Animated.View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  button: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
