import type { LucideIcon } from 'lucide-react-native';
import { ActivityIndicator, type GestureResponderEvent, type PressableProps, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { FadeIn, FadeOut, ZoomIn, ZoomOut } from 'react-native-reanimated';

import { haptic, PressableScale } from '@/shared/motion';
import { radius, typography, useTheme } from '@/shared/theme';

import { Text } from './Text';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps extends Omit<PressableProps, 'style' | 'children'> {
  label: string;
  variant?: Variant;
  size?: 'md' | 'sm';
  icon?: LucideIcon;
  /** Icône (ou logo) personnalisée à gauche du libellé. */
  leading?: React.ReactNode;
  loading?: boolean;
  block?: boolean;
  style?: StyleProp<ViewStyle>;
  /** Couleurs imposées (boutons de marque : GitHub, Google). */
  tone?: { bg: string; fg: string; border: string };
}

export function Button({
  label,
  variant = 'primary',
  size = 'md',
  icon: Icon,
  leading,
  loading,
  block,
  disabled,
  style,
  tone,
  onPress,
  ...props
}: ButtonProps) {
  const { colors } = useTheme();
  const palette =
    tone ??
    {
      primary: { bg: colors.primary, fg: colors.onPrimary, border: colors.primary },
      secondary: { bg: colors.background, fg: colors.ink, border: colors.lineStrong },
      ghost: { bg: 'transparent', fg: colors.inkMuted, border: 'transparent' },
      danger: { bg: colors.dangerSoft, fg: colors.danger, border: colors.dangerSoft },
    }[variant];
  const inactive = disabled || loading;
  const height = size === 'md' ? 50 : 36;

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(inactive), busy: Boolean(loading) }}
      disabled={inactive}
      onPress={(event) => {
        haptic.tap();
        onPress?.(event);
      }}
      style={[
        styles.base,
        {
          height,
          paddingHorizontal: size === 'md' ? 20 : 14,
          backgroundColor: palette.bg,
          borderColor: palette.border,
          opacity: disabled && !loading ? 0.45 : 1,
          alignSelf: block ? 'stretch' : 'auto',
        },
        style,
      ]}
      {...props}
    >
      {loading ? (
        <Animated.View key="loading" entering={ZoomIn.duration(160)} exiting={ZoomOut.duration(120)}>
          <ActivityIndicator size="small" color={palette.fg} />
        </Animated.View>
      ) : (
        <Animated.View key="label" entering={FadeIn.duration(160)} exiting={FadeOut.duration(100)} style={styles.row}>
          {leading}
          {Icon ? <Icon size={size === 'md' ? 18 : 16} color={palette.fg} strokeWidth={2.2} /> : null}
          <Text style={[size === 'md' ? typography.bodyStrong : typography.smallStrong, { color: palette.fg }]}>{label}</Text>
        </Animated.View>
      )}
    </PressableScale>
  );
}

/** Bouton icône rond (en-têtes, actions secondaires), zone tactile de 44 pt. */
export function IconButton({
  icon: Icon,
  label,
  onPress,
  color,
  size = 22,
  badge,
}: {
  icon: LucideIcon;
  label: string;
  onPress?: (event: GestureResponderEvent) => void;
  color?: string;
  size?: number;
  badge?: number;
}) {
  const { colors } = useTheme();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={(event) => {
        haptic.select();
        onPress?.(event);
      }}
      hitSlop={6}
      scaleTo={0.85}
      style={styles.icon}
    >
      <Icon size={size} color={color ?? colors.ink} strokeWidth={2} />
      {badge ? (
        <Animated.View
          entering={ZoomIn.springify().damping(12)}
          exiting={ZoomOut}
          style={[styles.badge, { backgroundColor: colors.primary, borderColor: colors.background }]}
        >
          <Text variant="caption" tone="onPrimary" style={styles.badgeText}>
            {badge > 99 ? '99+' : badge}
          </Text>
        </Animated.View>
      ) : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth * 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    top: 4,
    right: 2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontSize: 10, lineHeight: 12, fontWeight: '700' },
});
