import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Loader2, Play } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { absoluteUrl } from '@/shared/api';
import { useDataSaver } from '@/shared/data-saver';
import { useT } from '@/shared/i18n';
import { radius, useTheme } from '@/shared/theme';
import { Text } from '@/shared/ui';

import type { Media } from './api';

/** Cadre de la vidéo : son format, borné entre le portrait 4:5 et le paysage 16:9 (vidéo entière). */
function frameRatio(media: Media) {
  const natural = media.width && media.height ? media.width / media.height : 16 / 9;
  return Math.min(16 / 9, Math.max(4 / 5, natural));
}

/** Source lue : HLS (débit adapté au réseau), sinon MP4 (Cloudinary), sinon le fichier envoyé. */
function sourceOf(media: Media) {
  return absoluteUrl(media.urls.hls ?? media.urls.mp4 ?? media.original_url) ?? '';
}

/**
 * Vidéo d'un post, comme sur le site : affiche d'abord, jamais de lecture automatique (forfaits
 * mobiles). Le lecteur n'est créé qu'au toucher : un fil de vidéos ne télécharge rien d'avance.
 */
export function PostVideo({ media }: { media: Media }) {
  const { colors } = useTheme();
  const { t } = useT();
  const { textOnly } = useDataSaver();
  const [playing, setPlaying] = useState(false);
  const ratio = frameRatio(media);
  const poster = textOnly ? undefined : absoluteUrl(media.urls.poster);
  const frame = [styles.frame, { aspectRatio: ratio, backgroundColor: '#000' }];

  if (media.status !== 'ready') {
    return (
      <View style={[frame, styles.center]}>
        <Loader2 size={22} color="#FFFFFF" />
        <Text variant="small" style={styles.light}>
          {t('video.processing')}
        </Text>
      </View>
    );
  }
  if (playing) return <Player uri={sourceOf(media)} style={frame} />;
  return (
    <Pressable
      onPress={() => setPlaying(true)}
      accessibilityRole="button"
      accessibilityLabel={t('video.play')}
      style={[frame, styles.center]}
    >
      {poster ? (
        <Image source={{ uri: poster }} style={StyleSheet.absoluteFill} contentFit="contain" transition={150} />
      ) : null}
      <View style={[styles.play, { backgroundColor: colors.primary }]}>
        <Play size={26} color="#FFFFFF" fill="#FFFFFF" />
      </View>
      {media.duration_seconds ? (
        <View style={styles.duration}>
          <Text variant="caption" style={styles.light}>
            {`${Math.floor(media.duration_seconds / 60)}:${String(Math.round(media.duration_seconds % 60)).padStart(2, '0')}`}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

function Player({ uri, style }: { uri: string; style: object }) {
  const player = useVideoPlayer(uri, (instance) => instance.play());
  return <VideoView player={player} style={style} nativeControls allowsFullscreen allowsPictureInPicture contentFit="contain" />;
}

const styles = StyleSheet.create({
  frame: { width: '100%', borderRadius: radius.md, overflow: 'hidden' },
  center: { alignItems: 'center', justifyContent: 'center', gap: 8 },
  play: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', paddingLeft: 4 },
  duration: { position: 'absolute', right: 8, bottom: 8, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: 'rgba(0,0,0,0.6)' },
  light: { color: '#FFFFFF' },
});
