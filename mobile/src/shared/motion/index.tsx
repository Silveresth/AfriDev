import * as Haptics from 'expo-haptics';
import { forwardRef, useEffect } from 'react';
import { Platform, Pressable, type PressableProps, type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { t } from '@/shared/i18n';
import { radius, useTheme } from '@/shared/theme';

/** Ressorts communs : vifs mais sans rebond excessif. */
export const SPRING = { damping: 16, stiffness: 220, mass: 0.7 } as const;
export const SOFT_SPRING = { damping: 18, stiffness: 140 } as const;

// ── Retours haptiques (silencieux sur le web) ──

const canVibrate = Platform.OS !== 'web';
export const haptic = {
  tap: () => canVibrate && void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined),
  select: () => canVibrate && void Haptics.selectionAsync().catch(() => undefined),
  success: () =>
    canVibrate && void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined),
  error: () => canVibrate && void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined),
};

// ── Pression élastique ──

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Pressable qui s'enfonce légèrement au toucher puis rebondit (boutons, cartes, pastilles). */
export const PressableScale = forwardRef<View, Omit<PressableProps, 'style'> & { style?: StyleProp<ViewStyle>; scaleTo?: number }>(
  function PressableScale({ style, scaleTo = 0.96, onPressIn, onPressOut, ...props }, ref) {
    const scale = useSharedValue(1);
    const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
    return (
      <AnimatedPressable
        ref={ref}
        {...props}
        onPressIn={(event) => {
          scale.value = withSpring(scaleTo, SPRING);
          onPressIn?.(event);
        }}
        onPressOut={(event) => {
          scale.value = withSpring(1, SPRING);
          onPressOut?.(event);
        }}
        style={[style, animated]}
      />
    );
  },
);

// ── Apparition des listes ──

/** Les 10 premières lignes glissent en cascade ; au-delà (défilement), pas d'animation. */
export function enteringAt(index: number) {
  return index < 10 ? FadeInDown.delay(index * 45).duration(380).easing(Easing.out(Easing.cubic)) : undefined;
}

export function AppearItem({ index, children }: { index: number; children: React.ReactNode }) {
  return <Animated.View entering={enteringAt(index)}>{children}</Animated.View>;
}

// ── Squelettes de chargement (aplats qui pulsent, sans dégradé) ──

function usePulse() {
  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 850, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [pulse]);
  return useAnimatedStyle(() => ({ opacity: 0.45 + pulse.value * 0.55 }));
}

export function Bone({ width, height = 12, round, style }: { width: ViewStyle['width']; height?: number; round?: boolean; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  return (
    <View
      style={[{ width, height, borderRadius: round ? height / 2 : radius.sm, backgroundColor: colors.containerHigh }, style]}
    />
  );
}

/** Liste fantôme pendant le premier chargement : la mise en page apparaît avant les données. */
export function SkeletonList({ variant = 'post', count = 4 }: { variant?: 'post' | 'news' | 'row'; count?: number }) {
  const { colors } = useTheme();
  const pulse = usePulse();
  return (
    <Animated.View style={pulse} accessibilityLabel={t('state.loading')} accessibilityRole="progressbar">
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={[styles.skeleton, { borderBottomColor: colors.line }]}>
          {variant === 'row' ? (
            <View style={styles.row}>
              <Bone width={44} height={44} />
              <View style={styles.flex}>
                <Bone width="70%" height={14} />
                <Bone width="95%" />
                <Bone width="40%" />
              </View>
            </View>
          ) : (
            <>
              <View style={styles.row}>
                <Bone width={22} height={22} round />
                <Bone width="45%" />
              </View>
              <View style={styles.row}>
                <View style={styles.flex}>
                  <Bone width="92%" height={16} />
                  <Bone width="70%" height={16} />
                  <Bone width="85%" />
                </View>
                {variant === 'news' ? <Bone width={76} height={76} /> : null}
              </View>
              {variant === 'post' ? (
                <View style={styles.row}>
                  <Bone width={92} height={34} round />
                  <Bone width={60} height={34} round />
                </View>
              ) : null}
            </>
          )}
        </View>
      ))}
    </Animated.View>
  );
}

// ── Points de chargement (pied de liste) ──

function Dot({ index }: { index: number }) {
  const { colors } = useTheme();
  const y = useSharedValue(0);
  useEffect(() => {
    y.value = withDelay(
      index * 140,
      withRepeat(withSequence(withTiming(-6, { duration: 280 }), withTiming(0, { duration: 280 }), withTiming(0, { duration: 280 })), -1),
    );
  }, [index, y]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }], opacity: 0.5 - y.value / 12 }));
  return <Animated.View style={[styles.dot, { backgroundColor: colors.primary }, style]} />;
}

export function Dots() {
  return (
    <View style={styles.dots} accessibilityLabel={t('state.loading')}>
      {[0, 1, 2].map((i) => (
        <Dot key={i} index={i} />
      ))}
    </View>
  );
}

// ── Secousse (erreur de saisie) ──

/** Secoue son contenu à chaque changement de `trigger` (ex. compteur d'erreurs). */
export function Shake({ trigger, children }: { trigger: number; children: React.ReactNode }) {
  const x = useSharedValue(0);
  useEffect(() => {
    if (!trigger) return;
    x.value = withSequence(
      withTiming(-10, { duration: 50 }),
      withTiming(10, { duration: 70 }),
      withTiming(-7, { duration: 60 }),
      withTiming(5, { duration: 60 }),
      withSpring(0, SPRING),
    );
  }, [trigger, x]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  skeleton: { padding: 16, gap: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  flex: { flex: 1, gap: 8 },
  dots: { flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', height: 24 },
  dot: { width: 7, height: 7, borderRadius: 4 },
});
