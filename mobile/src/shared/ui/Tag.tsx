import { StyleSheet, View } from 'react-native';

import { radius, useTheme } from '@/shared/theme';

import { Text } from './Text';

export function Tag({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'primary' | 'success' }) {
  const { colors } = useTheme();
  const palette = {
    neutral: { bg: colors.container, fg: colors.inkMuted },
    primary: { bg: colors.primarySoft, fg: colors.primaryInk },
    success: { bg: colors.secondarySoft, fg: colors.secondaryInk },
  }[tone];
  return (
    <View style={[styles.tag, { backgroundColor: palette.bg }]}>
      <Text variant="caption" style={{ color: palette.fg }} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

export function TagRow({ tags, max = 3 }: { tags: string[]; max?: number }) {
  if (!tags.length) return null;
  return (
    <View style={styles.row}>
      {tags.slice(0, max).map((tag) => (
        <Tag key={tag} label={`#${tag}`} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  tag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
});
