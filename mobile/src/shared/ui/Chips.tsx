import { useEffect } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { haptic, PressableScale } from '@/shared/motion';
import { radius, typography, useTheme } from '@/shared/theme';

export interface ChipOption<T extends string> {
  value: T;
  label: string;
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  const on = useSharedValue(active ? 1 : 0);
  useEffect(() => {
    on.value = withTiming(active ? 1 : 0, { duration: 220 });
  }, [active, on]);

  const box = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(on.value, [0, 1], [colors.background, colors.ink]),
    borderColor: interpolateColor(on.value, [0, 1], [colors.lineStrong, colors.ink]),
  }));
  const text = useAnimatedStyle(() => ({ color: interpolateColor(on.value, [0, 1], [colors.inkMuted, colors.background]) }));

  return (
    <PressableScale accessibilityRole="tab" accessibilityState={{ selected: active }} onPress={onPress} scaleTo={0.92}>
      <Animated.View style={[styles.chip, box]}>
        <Animated.Text style={[typography.smallStrong, text]}>{label}</Animated.Text>
      </Animated.View>
    </PressableScale>
  );
}

/** Rangée de pastilles défilante (tri, filtres) : la pastille active se remplit en douceur. */
export function Chips<T extends string>({
  options,
  value,
  onChange,
}: {
  options: ChipOption<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  const { colors } = useTheme();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      style={[styles.bar, { borderBottomColor: colors.line, backgroundColor: colors.background }]}
    >
      {options.map((option) => (
        <Chip
          key={option.value}
          label={option.label}
          active={option.value === value}
          onPress={() => {
            if (option.value !== value) haptic.select();
            onChange(option.value);
          }}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // flexShrink 0 : une longue liste en dessous ne doit jamais écraser la rangée.
  bar: { flexGrow: 0, flexShrink: 0, borderBottomWidth: StyleSheet.hairlineWidth },
  row: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  chip: {
    height: 32,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth * 2,
    justifyContent: 'center',
  },
});
