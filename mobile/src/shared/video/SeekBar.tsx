import { useRef, useState } from 'react';
import { type LayoutChangeEvent, PanResponder, StyleSheet, View } from 'react-native';

import { t } from '@/shared/i18n';

/**
 * Barre de progression : partie lue, mémoire tampon, curseur. Toucher ou glisser déplace la
 * lecture ; pendant le glissement seul le curseur bouge, la vidéo saute au relâchement.
 */
export function SeekBar({
  current,
  buffered,
  duration,
  color,
  onSeek,
  onScrub,
}: {
  current: number;
  buffered: number;
  duration: number;
  color: string;
  onSeek: (seconds: number) => void;
  /** Début / fin d'un glissement (les commandes restent affichées pendant ce temps). */
  onScrub?: (active: boolean) => void;
}) {
  const width = useRef(0);
  const [drag, setDrag] = useState<number | null>(null);
  const latest = useRef({ duration, onSeek, onScrub });
  latest.current = { duration, onSeek, onScrub };

  // Bord gauche de la barre à l'écran, relevé au premier toucher : la suite du geste se calcule
  // en coordonnées d'écran (le doigt peut sortir de la barre).
  const origin = useRef(0);
  const ratioAt = (pageX: number) => (width.current ? Math.min(1, Math.max(0, (pageX - origin.current) / width.current)) : 0);
  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      // Un glissement horizontal sur la barre ne doit pas faire défiler la liste.
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (event) => {
        origin.current = event.nativeEvent.pageX - event.nativeEvent.locationX;
        latest.current.onScrub?.(true);
        setDrag(ratioAt(event.nativeEvent.pageX));
      },
      onPanResponderMove: (_event, gesture) => setDrag(ratioAt(gesture.moveX)),
      onPanResponderRelease: (_event, gesture) => {
        const ratio = ratioAt(gesture.moveX || gesture.x0);
        latest.current.onSeek(ratio * latest.current.duration);
        latest.current.onScrub?.(false);
        setDrag(null);
      },
      onPanResponderTerminate: () => {
        latest.current.onScrub?.(false);
        setDrag(null);
      },
    }),
  ).current;

  const played = drag ?? (duration ? current / duration : 0);
  const loaded = duration ? Math.min(1, buffered / duration) : 0;
  return (
    <View
      {...responder.panHandlers}
      onLayout={(event: LayoutChangeEvent) => {
        width.current = event.nativeEvent.layout.width;
      }}
      hitSlop={{ top: 12, bottom: 12 }}
      accessibilityRole="adjustable"
      accessibilityLabel={t('video.seek')}
      accessibilityValue={{ min: 0, max: Math.round(duration), now: Math.round(played * duration) }}
      style={styles.touch}
    >
      <View style={styles.track} pointerEvents="none">
        <View style={[styles.fill, styles.buffer, { width: `${loaded * 100}%` }]} />
        <View style={[styles.fill, { width: `${played * 100}%`, backgroundColor: color }]} />
      </View>
      <View pointerEvents="none" style={[styles.thumb, { left: `${played * 100}%`, backgroundColor: color }, drag !== null && styles.thumbActive]} />
    </View>
  );
}

const styles = StyleSheet.create({
  touch: { height: 24, justifyContent: 'center' },
  track: { height: 4, borderRadius: 2, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.25)' },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0 },
  buffer: { backgroundColor: 'rgba(255,255,255,0.45)' },
  thumb: { position: 'absolute', width: 14, height: 14, borderRadius: 7, marginLeft: -7, top: 5 },
  thumbActive: { width: 20, height: 20, borderRadius: 10, marginLeft: -10, top: 2 },
});
