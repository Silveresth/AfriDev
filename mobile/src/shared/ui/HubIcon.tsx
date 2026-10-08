import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { AVATAR_COLORS, radius, useTheme } from '@/shared/theme';

function colorFor(seed: string) {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

/** Icône d'un hub : émoji, image, ou initiale sur une couleur unie stable. */
export function HubIcon({ icon, name, size = 40 }: { icon?: string | null; name: string; size?: number }) {
  const { colors } = useTheme();
  const isImage = Boolean(icon && /^https?:\/\//.test(icon));
  const isEmoji = Boolean(icon && !isImage);
  return (
    <View
      style={[
        styles.base,
        {
          width: size,
          height: size,
          borderRadius: size > 48 ? radius.lg : radius.md,
          backgroundColor: isEmoji ? colors.container : colorFor(name),
        },
      ]}
    >
      <Text style={{ fontSize: isEmoji ? size * 0.55 : size * 0.45, fontWeight: '700', color: '#FFFFFF' }}>
        {isEmoji ? icon : name.slice(0, 1).toUpperCase()}
      </Text>
      {isImage ? <Image source={{ uri: icon! }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
