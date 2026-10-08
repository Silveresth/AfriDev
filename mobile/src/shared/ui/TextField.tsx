import type { LucideIcon } from 'lucide-react-native';
import { forwardRef, useEffect, useState } from 'react';
import { StyleSheet, TextInput, type TextInputProps, View } from 'react-native';
import Animated, { FadeInDown, FadeOut, interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { radius, typography, useTheme } from '@/shared/theme';

import { Text } from './Text';

interface FieldProps extends TextInputProps {
  label?: string;
  hint?: string;
  error?: string | null;
  /** Icône à gauche du champ. */
  icon?: LucideIcon;
  /** Élément à droite (bouton « afficher le mot de passe »…). */
  trailing?: React.ReactNode;
}

export const TextField = forwardRef<TextInput, FieldProps>(function TextField(
  { label, hint, error, multiline, style, onFocus, onBlur, icon: Icon, trailing, ...props },
  ref,
) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const focus = useSharedValue(0);

  useEffect(() => {
    focus.value = withTiming(focused ? 1 : 0, { duration: 180 });
  }, [focus, focused]);

  const frame = useAnimatedStyle(() => ({
    borderColor: error ? colors.danger : interpolateColor(focus.value, [0, 1], [colors.lineStrong, colors.primary]),
    backgroundColor: interpolateColor(focus.value, [0, 1], [colors.surface, colors.background]),
  }));

  return (
    <View style={styles.wrap}>
      {label ? <Text variant="smallStrong">{label}</Text> : null}
      <Animated.View style={[styles.frame, multiline ? styles.multiline : null, frame]}>
        {Icon ? <Icon size={18} color={focused ? colors.primary : colors.inkFaint} style={multiline ? styles.iconTop : null} /> : null}
        <TextInput
          ref={ref}
          placeholderTextColor={colors.inkFaint}
          selectionColor={colors.primary}
          multiline={multiline}
          textAlignVertical={multiline ? 'top' : 'center'}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          style={[typography.body, styles.input, multiline ? styles.inputMultiline : null, { color: colors.ink }, style]}
          {...props}
        />
        {trailing}
      </Animated.View>
      {error ? (
        <Animated.View entering={FadeInDown.duration(200)} exiting={FadeOut.duration(120)}>
          <Text variant="small" tone="danger">
            {error}
          </Text>
        </Animated.View>
      ) : hint ? (
        <Text variant="small" tone="faint">
          {hint}
        </Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  frame: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1.5,
    borderRadius: radius.md,
    paddingHorizontal: 14,
  },
  multiline: { alignItems: 'flex-start', minHeight: 140, paddingVertical: 12 },
  iconTop: { marginTop: 3 },
  input: { flex: 1, paddingVertical: 12 },
  inputMultiline: { paddingVertical: 0, minHeight: 116 },
});
