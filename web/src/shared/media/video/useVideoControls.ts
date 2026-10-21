'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

import { attachSource } from './source';

type WebkitVideo = HTMLVideoElement & { webkitEnterFullscreen?: () => void };

const noSubscribe = () => () => {};
const pipAvailable = () => 'pictureInPictureEnabled' in document && document.pictureInPictureEnabled;

export interface VideoSourceOptions {
  /** Source branchée seulement une fois vrai (rien n'est téléchargé avant). */
  active: boolean;
  hls?: string | null;
  src: string;
  maxHeight: number;
  autoPlay: boolean;
}

/**
 * Lecteur <video> : refs à poser sur la vidéo et son conteneur, état lu depuis les événements
 * (lecture, temps, tampon, volume, vitesse, plein écran, PiP) et actions des commandes.
 * Plein écran sur le conteneur (nos commandes restent visibles) ; iPhone : plein écran natif.
 */
export function useVideoControls({ active, hls, src, maxHeight, autoPlay }: VideoSourceOptions) {
  const video = useRef<HTMLVideoElement>(null);
  const container = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [ended, setEnded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolumeState] = useState(1);
  const [muted, setMuted] = useState(false);
  const [rate, setRateState] = useState(1);
  const [fullscreen, setFullscreen] = useState(false);
  const [pip, setPip] = useState(false);
  const pipSupported = useSyncExternalStore(noSubscribe, pipAvailable, () => false);

  useEffect(() => {
    const element = video.current;
    if (!active || !element) return;
    return attachSource(element, { hls, src, maxHeight, autoPlay });
  }, [active, autoPlay, hls, maxHeight, src]);

  useEffect(() => {
    const element = video.current;
    if (!element) return;
    const readBuffer = () => {
      const ranges = element.buffered;
      setBuffered(ranges.length ? ranges.end(ranges.length - 1) : 0);
    };
    const readDuration = () => setDuration(Number.isFinite(element.duration) ? element.duration : 0);
    const handlers: Record<string, () => void> = {
      play: () => {
        setPlaying(true);
        setEnded(false);
        setFailed(false);
      },
      pause: () => setPlaying(false),
      waiting: () => setWaiting(true),
      playing: () => setWaiting(false),
      canplay: () => setWaiting(false),
      ended: () => {
        setPlaying(false);
        setEnded(true);
      },
      error: () => {
        setFailed(true);
        setWaiting(false);
      },
      timeupdate: () => setCurrentTime(element.currentTime),
      durationchange: readDuration,
      loadedmetadata: readDuration,
      progress: readBuffer,
      volumechange: () => {
        setVolumeState(element.volume);
        setMuted(element.muted);
      },
      ratechange: () => setRateState(element.playbackRate),
      enterpictureinpicture: () => setPip(true),
      leavepictureinpicture: () => setPip(false),
    };
    for (const [name, handler] of Object.entries(handlers)) element.addEventListener(name, handler);
    return () => {
      for (const [name, handler] of Object.entries(handlers)) element.removeEventListener(name, handler);
    };
  }, []);

  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement) && document.fullscreenElement === container.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggle = () => {
    const element = video.current;
    if (!element) return;
    if (element.paused || element.ended) void element.play().catch(() => {});
    else element.pause();
  };

  const seekTo = (seconds: number) => {
    const element = video.current;
    if (!element) return;
    const end = Number.isFinite(element.duration) ? element.duration : seconds;
    element.currentTime = Math.max(0, Math.min(seconds, end));
    setCurrentTime(element.currentTime);
  };
  const seekBy = (seconds: number) => seekTo((video.current?.currentTime ?? 0) + seconds);

  const setVolume = (value: number) => {
    const element = video.current;
    if (!element) return;
    element.volume = Math.max(0, Math.min(1, value));
    element.muted = element.volume === 0;
  };
  const toggleMute = () => {
    const element = video.current;
    if (!element) return;
    element.muted = !element.muted;
    if (!element.muted && element.volume === 0) element.volume = 0.6;
  };

  const setRate = (value: number) => {
    if (video.current) video.current.playbackRate = value;
  };

  const toggleFullscreen = () => {
    const box = container.current;
    const element = video.current as WebkitVideo | null;
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    else if (box?.requestFullscreen) void box.requestFullscreen().catch(() => element?.webkitEnterFullscreen?.());
    else element?.webkitEnterFullscreen?.();
  };

  const togglePip = () => {
    const element = video.current;
    if (!element) return;
    if (document.pictureInPictureElement) void document.exitPictureInPicture().catch(() => {});
    else void element.requestPictureInPicture?.().catch(() => {});
  };

  const retry = () => {
    const element = video.current;
    if (!element) return;
    setFailed(false);
    element.load();
    void element.play().catch(() => {});
  };

  return {
    video,
    container,
    playing,
    waiting,
    ended,
    failed,
    currentTime,
    duration,
    buffered,
    volume,
    muted,
    rate,
    fullscreen,
    pip,
    pipSupported,
    toggle,
    seekTo,
    seekBy,
    setVolume,
    toggleMute,
    setRate,
    toggleFullscreen,
    togglePip,
    retry,
  };
}

export type VideoControlsState = ReturnType<typeof useVideoControls>;
