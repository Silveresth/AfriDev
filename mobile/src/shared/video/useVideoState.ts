import { useEvent } from 'expo';
import type { VideoPlayer } from 'expo-video';
import { useCallback, useEffect, useState } from 'react';

import { nextSpeed } from './format';

/**
 * État lu d'un lecteur expo-video (lecture, position, mémoire tampon, vitesse, son) et les actions
 * des commandes. Seuls les événements natifs font re-rendre : rien n'est sondé en JS.
 */
export function useVideoState(player: VideoPlayer) {
  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });
  const { status, error } = useEvent(player, 'statusChange', { status: player.status, error: undefined });
  const { muted } = useEvent(player, 'mutedChange', { muted: player.muted });
  const { playbackRate } = useEvent(player, 'playbackRateChange', { playbackRate: player.playbackRate });
  const time = useEvent(player, 'timeUpdate', {
    currentTime: player.currentTime,
    bufferedPosition: player.bufferedPosition,
    currentLiveTimestamp: null,
    currentOffsetFromLive: null,
  });
  const [duration, setDuration] = useState(player.duration);
  const [ended, setEnded] = useState(false);

  useEffect(() => {
    const load = player.addListener('sourceLoad', ({ duration: loaded }) => setDuration(loaded));
    const end = player.addListener('playToEnd', () => setEnded(true));
    return () => {
      load.remove();
      end.remove();
    };
  }, [player]);
  useEffect(() => {
    if (isPlaying) setEnded(false);
  }, [isPlaying]);

  const toggle = useCallback(() => {
    if (ended) player.replay();
    else if (player.playing) player.pause();
    else player.play();
  }, [ended, player]);
  const seekBy = useCallback((seconds: number) => player.seekBy(seconds), [player]);
  const seekTo = useCallback(
    (seconds: number) => {
      player.currentTime = Math.max(0, Math.min(seconds, player.duration || seconds));
    },
    [player],
  );
  const toggleMute = useCallback(() => {
    player.muted = !player.muted;
  }, [player]);
  const cycleSpeed = useCallback(() => {
    player.playbackRate = nextSpeed(player.playbackRate);
  }, [player]);
  const retry = useCallback(() => {
    player.replay();
  }, [player]);

  return {
    playing: isPlaying,
    loading: status === 'loading',
    failed: status === 'error',
    error,
    ended,
    muted,
    rate: playbackRate,
    currentTime: time.currentTime,
    buffered: time.bufferedPosition,
    duration: duration || player.duration || 0,
    toggle,
    seekBy,
    seekTo,
    toggleMute,
    cycleSpeed,
    retry,
  };
}

export type VideoState = ReturnType<typeof useVideoState>;
