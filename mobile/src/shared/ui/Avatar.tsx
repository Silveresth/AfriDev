import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { absoluteUrl } from '@/shared/api';
import { useDataSaver } from '@/shared/data-saver';
import { initials } from '@/shared/lib';
import { AVATAR_COLORS } from '@/shared/theme';

function colorFor(seed: string) {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

/** Initiales sur fond uni (0 octet réseau) ; la photo, si elle existe, se superpose. */
export function Avatar({ name, src, size = 36, color }: { name: string; src?: string | null; size?: number; color?: string }) {
  const [failed, setFailed] = useState(false);
  const { textOnly } = useDataSaver();
  // Mode texte seul : initiales uniquement (aucune photo téléchargée).
  const uri = textOnly ? undefined : absoluteUrl(src);
  return (
    <View
      style={[styles.base, { width: size, height: size, borderRadius: size / 2, backgroundColor: color || colorFor(name) }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Text style={[styles.initials, { fontSize: Math.max(11, size * 0.38) }]}>{initials(name)}</Text>
      {uri && !failed ? (
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={120}
          cachePolicy="memory-disk"
          onError={() => setFailed(true)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  initials: { color: '#FFFFFF', fontWeight: '700' },
});
