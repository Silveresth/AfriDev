import { Text as RNText, type TextProps } from 'react-native';

import { type Palette, typography, type TypeVariant, useTheme } from '@/shared/theme';

export type Tone = 'ink' | 'muted' | 'faint' | 'primary' | 'secondary' | 'danger' | 'onPrimary';

const TONES: Record<Tone, keyof Palette> = {
  ink: 'ink',
  muted: 'inkMuted',
  faint: 'inkFaint',
  primary: 'primaryInk',
  secondary: 'secondaryInk',
  danger: 'danger',
  onPrimary: 'onPrimary',
};

export function Text({
  variant = 'body',
  tone = 'ink',
  style,
  ...props
}: TextProps & { variant?: TypeVariant; tone?: Tone }) {
  const { colors } = useTheme();
  return <RNText {...props} style={[typography[variant], { color: colors[TONES[tone]] }, style]} />;
}
