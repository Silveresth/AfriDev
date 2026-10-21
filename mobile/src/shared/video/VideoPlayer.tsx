import { useVideoPlayer, VideoView, type VideoContentFit } from 'expo-video';
import { useRef } from 'react';
import { type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';

import { useVideoState } from './useVideoState';
import { VideoControls } from './VideoControls';

/**
 * Lecteur vidéo de l'appli (posts, messages) : expo-video sans commandes natives, avec nos
 * commandes (pause, ±10 s, progression, son, vitesse, image dans l'image, plein écran).
 * Le plein écran est celui du système (rotation, commandes natives).
 */
export function VideoPlayer({
  uri,
  style,
  autoPlay = true,
  compact = false,
  contentFit = 'contain',
}: {
  uri: string;
  style?: StyleProp<ViewStyle>;
  autoPlay?: boolean;
  /** Petite surface (bulle de message) : commandes réduites. */
  compact?: boolean;
  contentFit?: VideoContentFit;
}) {
  const view = useRef<VideoView>(null);
  const player = useVideoPlayer(uri, (instance) => {
    instance.timeUpdateEventInterval = 0.25;
    if (autoPlay) instance.play();
  });
  const state = useVideoState(player);

  return (
    <View style={[styles.frame, style]}>
      <VideoView
        ref={view}
        player={player}
        style={StyleSheet.absoluteFill}
        nativeControls={false}
        allowsFullscreen
        allowsPictureInPicture
        contentFit={contentFit}
      />
      <VideoControls
        state={state}
        compact={compact}
        onFullscreen={() => void view.current?.enterFullscreen().catch(() => undefined)}
        onPictureInPicture={() => void view.current?.startPictureInPicture().catch(() => undefined)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { backgroundColor: '#000', overflow: 'hidden' },
});
