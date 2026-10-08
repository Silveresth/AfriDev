import { useEffect } from 'react';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { t } from '@/shared/i18n';
import { useTheme } from '@/shared/theme';

import { BRAND_GREEN, BrandMark } from './BrandMark';

/** Chargement aux couleurs de la marque : les chevrons respirent, le point bat. */
export function BrandLoader({ size = 56 }: { size?: number }) {
  const { colors } = useTheme();
  const beat = useSharedValue(0);

  useEffect(() => {
    beat.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 520, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 520, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
    );
  }, [beat]);

  const shift = size * 0.08;
  const left = useAnimatedStyle(() => ({ transform: [{ translateX: -beat.value * shift }] }));
  const right = useAnimatedStyle(() => ({ transform: [{ translateX: beat.value * shift }] }));
  const dot = useAnimatedStyle(() => ({ transform: [{ scale: 0.7 + beat.value * 0.6 }], opacity: 0.6 + beat.value * 0.4 }));

  return (
    <Animated.View accessibilityLabel={t('state.loading')} accessibilityRole="progressbar">
      <BrandMark size={size} color={colors.primary} dotColor={BRAND_GREEN} leftStyle={left} rightStyle={right} dotStyle={dot} />
    </Animated.View>
  );
}
