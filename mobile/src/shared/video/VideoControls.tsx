import { Maximize, Pause, PictureInPicture2, Play, RefreshCw, RotateCcw, RotateCw, Volume2, VolumeX } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { useT } from '@/shared/i18n';
import { haptic } from '@/shared/motion';
import { useTheme } from '@/shared/theme';
import { Text } from '@/shared/ui';

import { formatTime } from './format';
import { SeekBar } from './SeekBar';
import type { VideoState } from './useVideoState';

const HIDE_AFTER_MS = 2800;
const DOUBLE_TAP_MS = 280;
const SKIP_SECONDS = 10;

/**
 * Commandes superposées à la vidéo :
 * - toucher : afficher / masquer (masquées seules après 3 s de lecture) ;
 * - double toucher à gauche / à droite : reculer / avancer de 10 s ;
 * - centre : -10 s, lecture / pause, +10 s ; bas : progression, temps, son, vitesse, PiP, plein écran.
 * `compact` (bulle de message) : pas de vitesse ni de PiP.
 */
export function VideoControls({
  state,
  compact,
  onFullscreen,
  onPictureInPicture,
}: {
  state: VideoState;
  compact?: boolean;
  onFullscreen: () => void;
  onPictureInPicture?: () => void;
}) {
  const { colors } = useTheme();
  const { t } = useT();
  const [shown, setShown] = useState(true);
  const [scrubbing, setScrubbing] = useState(false);
  const [skipHint, setSkipHint] = useState<'back' | 'forward' | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTap = useRef<{ at: number; side: 'back' | 'forward' } | null>(null);
  const singleTap = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const keepVisible = !state.playing || scrubbing || state.loading || state.failed || state.ended;

  const scheduleHide = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setShown(false), HIDE_AFTER_MS);
  }, []);

  useEffect(() => {
    if (keepVisible) {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      setShown(true);
    } else if (shown) scheduleHide();
  }, [keepVisible, scheduleHide, shown]);

  useEffect(
    () => () => {
      for (const timer of [hideTimer.current, singleTap.current, hintTimer.current]) if (timer) clearTimeout(timer);
    },
    [],
  );

  /** Toute action garde les commandes visibles encore un moment. */
  const act = (action: () => void) => () => {
    haptic.tap();
    action();
    setShown(true);
    if (!keepVisible) scheduleHide();
  };

  const skip = (side: 'back' | 'forward') => {
    state.seekBy(side === 'back' ? -SKIP_SECONDS : SKIP_SECONDS);
    setSkipHint(side);
    if (hintTimer.current) clearTimeout(hintTimer.current);
    hintTimer.current = setTimeout(() => setSkipHint(null), 500);
  };

  const onSurfaceTap = (side: 'back' | 'forward') => {
    const now = Date.now();
    const previous = lastTap.current;
    if (previous && previous.side === side && now - previous.at < DOUBLE_TAP_MS) {
      if (singleTap.current) clearTimeout(singleTap.current);
      lastTap.current = null;
      haptic.tap();
      skip(side);
      return;
    }
    lastTap.current = { at: now, side };
    if (singleTap.current) clearTimeout(singleTap.current);
    singleTap.current = setTimeout(() => {
      setShown((value) => {
        if (!value && !keepVisible) scheduleHide();
        return !value;
      });
    }, DOUBLE_TAP_MS);
  };

  const PlayIcon = state.ended ? RotateCcw : state.playing ? Pause : Play;
  const playLabel = t(state.ended ? 'video.replay' : state.playing ? 'video.pause' : 'video.play');
  const big = compact ? 44 : 56;

  return (
    <View style={StyleSheet.absoluteFill}>
      {/* Deux moitiés tactiles : toucher simple = commandes, double toucher = ±10 s. */}
      <View style={styles.surface}>
        <Pressable style={styles.flex} onPress={() => onSurfaceTap('back')} accessible={false} />
        <Pressable style={styles.flex} onPress={() => onSurfaceTap('forward')} accessible={false} />
      </View>

      {skipHint ? (
        <Animated.View
          entering={FadeIn.duration(100)}
          exiting={FadeOut.duration(200)}
          pointerEvents="none"
          style={[styles.skipHint, skipHint === 'back' ? styles.skipLeft : styles.skipRight]}
        >
          {skipHint === 'back' ? <RotateCcw size={22} color="#FFFFFF" /> : <RotateCw size={22} color="#FFFFFF" />}
          <Text variant="caption" style={styles.light}>
            {skipHint === 'back' ? `-${SKIP_SECONDS} s` : `+${SKIP_SECONDS} s`}
          </Text>
        </Animated.View>
      ) : null}

      {state.loading && !state.failed ? (
        <View pointerEvents="none" style={styles.center}>
          <ActivityIndicator size="large" color="#FFFFFF" />
        </View>
      ) : null}

      {state.failed ? (
        <View style={[styles.center, styles.scrim]}>
          <Text variant="small" style={[styles.light, styles.errorText]}>
            {t('video.error')}
          </Text>
          <Pressable accessibilityRole="button" onPress={act(state.retry)} style={[styles.retry, { backgroundColor: colors.primary }]}>
            <RefreshCw size={16} color="#FFFFFF" />
            <Text variant="smallStrong" style={styles.light}>
              {t('video.retry')}
            </Text>
          </Pressable>
        </View>
      ) : shown ? (
        <Animated.View entering={FadeIn.duration(150)} exiting={FadeOut.duration(200)} style={[StyleSheet.absoluteFill, styles.scrim]} pointerEvents="box-none">
          <View style={styles.center} pointerEvents="box-none">
            <View style={styles.mainRow} pointerEvents="box-none">
              <RoundButton label={t('video.back10')} size={big - 12} onPress={act(() => skip('back'))}>
                <RotateCcw size={20} color="#FFFFFF" />
                <Text style={styles.skipNumber}>{SKIP_SECONDS}</Text>
              </RoundButton>
              {state.loading ? (
                <View style={{ width: big, height: big }} />
              ) : (
                <RoundButton label={playLabel} size={big} filled={colors.primary} onPress={act(state.toggle)}>
                  <PlayIcon size={compact ? 22 : 28} color="#FFFFFF" fill={state.playing || state.ended ? 'transparent' : '#FFFFFF'} />
                </RoundButton>
              )}
              <RoundButton label={t('video.forward10')} size={big - 12} onPress={act(() => skip('forward'))}>
                <RotateCw size={20} color="#FFFFFF" />
                <Text style={styles.skipNumber}>{SKIP_SECONDS}</Text>
              </RoundButton>
            </View>
          </View>

          <View style={styles.bottom} pointerEvents="box-none">
            <SeekBar
              current={state.currentTime}
              buffered={state.buffered}
              duration={state.duration}
              color={colors.primary}
              onSeek={state.seekTo}
              onScrub={setScrubbing}
            />
            <View style={styles.toolbar}>
              <Text variant="caption" style={[styles.light, styles.time]}>
                {`${formatTime(state.currentTime)} / ${formatTime(state.duration)}`}
              </Text>
              <View style={styles.flex} />
              <ToolButton label={t(state.muted ? 'video.unmute' : 'video.mute')} onPress={act(state.toggleMute)}>
                {state.muted ? <VolumeX size={18} color="#FFFFFF" /> : <Volume2 size={18} color="#FFFFFF" />}
              </ToolButton>
              {compact ? null : (
                <ToolButton label={t('video.speed')} onPress={act(state.cycleSpeed)}>
                  <Text variant="caption" style={[styles.light, styles.speed]}>{`${state.rate}×`}</Text>
                </ToolButton>
              )}
              {!compact && onPictureInPicture ? (
                <ToolButton label={t('video.pip')} onPress={act(onPictureInPicture)}>
                  <PictureInPicture2 size={18} color="#FFFFFF" />
                </ToolButton>
              ) : null}
              <ToolButton label={t('video.fullscreen')} onPress={act(onFullscreen)}>
                <Maximize size={18} color="#FFFFFF" />
              </ToolButton>
            </View>
          </View>
        </Animated.View>
      ) : null}
    </View>
  );
}

function RoundButton({
  label,
  size,
  filled,
  onPress,
  children,
}: {
  label: string;
  size: number;
  filled?: string;
  onPress: () => void;
  children: React.ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      onPress={onPress}
      style={({ pressed }) => [
        styles.round,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: filled ?? 'rgba(0,0,0,0.45)' },
        pressed && styles.pressed,
      ]}
    >
      {children}
    </Pressable>
  );
}

function ToolButton({ label, onPress, children }: { label: string; onPress: () => void; children: React.ReactNode }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={4}
      onPress={onPress}
      style={({ pressed }) => [styles.tool, pressed && styles.pressed]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  surface: { ...StyleSheet.absoluteFillObject, flexDirection: 'row' },
  scrim: { backgroundColor: 'rgba(0,0,0,0.32)' },
  center: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', gap: 12 },
  mainRow: { flexDirection: 'row', alignItems: 'center', gap: 28 },
  round: { alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.7, transform: [{ scale: 0.94 }] },
  skipNumber: { position: 'absolute', color: '#FFFFFF', fontSize: 8, fontWeight: '800' },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 12, paddingBottom: 6 },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 36 },
  tool: { minWidth: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  time: { fontVariant: ['tabular-nums'] },
  speed: { fontWeight: '700' },
  light: { color: '#FFFFFF' },
  errorText: { textAlign: 'center', paddingHorizontal: 24 },
  retry: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  skipHint: { position: 'absolute', top: '50%', marginTop: -32, width: 72, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.45)' },
  skipLeft: { left: 24 },
  skipRight: { right: 24 },
});
