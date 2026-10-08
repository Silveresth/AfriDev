import type { LucideIcon } from 'lucide-react-native';
import { type GestureResponderEvent, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { PressableScale } from '@/shared/motion';
import { radius, useTheme } from '@/shared/theme';

import { ForwardChevron } from './icons';
import { Text } from './Text';

/** Bloc de réglages : titre, description, puis contenu dans un cadre à filet fin. */
export function Section({
  title,
  description,
  icon: Icon,
  right,
  index = 0,
  children,
}: {
  title?: string;
  description?: string;
  icon?: LucideIcon;
  right?: React.ReactNode;
  index?: number;
  children: React.ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <Animated.View entering={FadeInDown.delay(index * 60).duration(320)} style={styles.section}>
      {title ? (
        <View style={styles.head}>
          {Icon ? (
            <View style={[styles.icon, { backgroundColor: colors.primarySoft }]}>
              <Icon size={16} color={colors.primaryInk} />
            </View>
          ) : null}
          <View style={styles.flex}>
            <Text variant="bodyStrong">{title}</Text>
            {description ? (
              <Text variant="small" tone="muted">
                {description}
              </Text>
            ) : null}
          </View>
          {right}
        </View>
      ) : null}
      <View style={[styles.box, { borderColor: colors.line, backgroundColor: colors.background }]}>{children}</View>
    </Animated.View>
  );
}

/** Ligne de réglage : icône, libellé, détail, et à droite un chevron, un interrupteur ou un badge. */
export function Row({
  icon: Icon,
  label,
  detail,
  right,
  onPress,
  danger,
  last,
}: {
  icon?: LucideIcon;
  label: string;
  detail?: string;
  right?: React.ReactNode;
  onPress?: (event: GestureResponderEvent) => void;
  danger?: boolean;
  last?: boolean;
}) {
  const { colors } = useTheme();
  const content = (
    <>
      {Icon ? <Icon size={20} color={danger ? colors.danger : colors.inkMuted} /> : null}
      <View style={styles.flex}>
        <Text tone={danger ? 'danger' : 'ink'}>{label}</Text>
        {detail ? (
          <Text variant="small" tone="faint" numberOfLines={2}>
            {detail}
          </Text>
        ) : null}
      </View>
      {right ?? (onPress ? <ForwardChevron size={18} color={colors.inkFaint} /> : null)}
    </>
  );
  const style = [styles.row, last ? null : { borderBottomColor: colors.line, borderBottomWidth: StyleSheet.hairlineWidth }];
  return onPress ? (
    <PressableScale scaleTo={0.985} onPress={onPress} style={style}>
      {content}
    </PressableScale>
  ) : (
    <View style={style}>{content}</View>
  );
}

/** Pastille d'état (« Active », « Non configurée »…). */
export function Badge({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'success' | 'warning' | 'danger' }) {
  const { colors } = useTheme();
  const palette = {
    neutral: [colors.container, colors.inkMuted],
    success: [colors.secondarySoft, colors.secondaryInk],
    warning: [colors.tertiarySoft, colors.tertiary],
    danger: [colors.dangerSoft, colors.danger],
  }[tone];
  return (
    <View style={[styles.badge, { backgroundColor: palette[0] }]}>
      <Text variant="caption" style={{ color: palette[1], fontWeight: '700' }}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 10 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 4 },
  icon: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, gap: 2 },
  box: { borderWidth: StyleSheet.hairlineWidth * 2, borderRadius: radius.lg, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, minHeight: 56, paddingVertical: 12 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill },
});
