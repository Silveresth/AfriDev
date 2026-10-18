import { Image } from 'expo-image';
import { ImageIcon } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { absoluteUrl } from '@/shared/api';
import { useDataSaver } from '@/shared/data-saver';
import { useT } from '@/shared/i18n';
import { radius, useTheme } from '@/shared/theme';
import { Text } from '@/shared/ui';

import type { Media } from './api';

/**
 * Cadre d'une image : son propre format tant qu'il reste raisonnable (portrait 4:5 à
 * paysage 1,91:1) ; au-delà, cadre borné et image entière sur son aperçu flou, jamais rognée.
 */
function frameOf(media: Media) {
  const natural = media.width && media.height ? media.width / media.height : 16 / 9;
  const shown = Math.min(1.91, Math.max(0.8, natural));
  return { shown, fits: Math.abs(shown - natural) < 0.02 };
}

/**
 * Image d'un post, pleine largeur. « feed » charge la petite variante, « detail » la grande.
 * En mode Texte seul, rien n'est téléchargé avant un toucher.
 */
export function PostImage({ media, variant, recyclingKey }: { media: Media; variant: 'feed' | 'detail'; recyclingKey?: string }) {
  const { colors } = useTheme();
  const { textOnly } = useDataSaver();
  const { t } = useT();
  const [revealed, setRevealed] = useState(false);
  const { shown, fits } = frameOf(media);
  const uri = absoluteUrl((variant === 'feed' ? media.urls.small : media.urls.large) ?? media.original_url);
  const placeholder = media.thumbhash ? { thumbhash: media.thumbhash } : undefined;
  const frame = [styles.frame, { aspectRatio: shown, backgroundColor: colors.container }];

  if (!uri) return null;
  if (textOnly && !revealed) {
    return (
      <Pressable onPress={() => setRevealed(true)} style={[frame, styles.hidden]}>
        <ImageIcon size={18} color={colors.inkMuted} />
        <Text variant="small" tone="muted">
          {t('feed.image_hidden')}
        </Text>
      </Pressable>
    );
  }
  return (
    <View style={frame}>
      {fits || !placeholder ? null : <Image source={placeholder} style={StyleSheet.absoluteFill} contentFit="cover" blurRadius={24} />}
      <Image
        source={{ uri }}
        placeholder={fits ? placeholder : undefined}
        style={StyleSheet.absoluteFill}
        contentFit={fits ? 'cover' : 'contain'}
        transition={180}
        cachePolicy="memory-disk"
        recyclingKey={recyclingKey}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { width: '100%', borderRadius: radius.md, overflow: 'hidden' },
  hidden: { alignItems: 'center', justifyContent: 'center', gap: 8 },
});
