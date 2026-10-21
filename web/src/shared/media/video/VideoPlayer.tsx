'use client';

import { Play } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { useDataSaver } from '@/shared/data-saver';
import { cn } from '@/shared/lib';

import { formatTime, SKIP_SECONDS } from './format';
import { useVideoControls } from './useVideoControls';
import { VideoControls } from './VideoControls';

const HIDE_AFTER_MS = 2500;
const DOUBLE_TAP_MS = 280;

export interface VideoPlayerProps {
  /** Fichier MP4 (repli si pas de HLS). */
  src: string;
  /** Flux HLS adaptatif (prioritaire). */
  hls?: string | null;
  poster?: string;
  durationSeconds?: number | null;
  /** Format du cadre (« 9 / 16 », « 16 / 9 »…). */
  aspectRatio?: string;
  maxHeight?: number;
  /** Démarre sans écran d'accueil (rien n'est téléchargé avant, sauf si vrai). */
  startImmediately?: boolean;
  className?: string;
}

/**
 * Lecteur vidéo du site : jamais de lecture automatique (affiche, puis clic) et hls.js chargé à la
 * demande. Commandes : lecture/pause, ±10 s, progression, volume, vitesse, image dans l'image,
 * plein écran. Clavier (lecteur ciblé) : espace/k, j/l (±10 s), ←/→ (±5 s), ↑/↓ volume, m, f, 0-9.
 * Tactile : toucher = commandes, double toucher à gauche/droite = ±10 s.
 */
export function VideoPlayer({
  src,
  hls,
  poster,
  durationSeconds,
  aspectRatio = '16 / 9',
  maxHeight = 520,
  startImmediately = false,
  className,
}: VideoPlayerProps) {
  const { maxVideoHeight } = useDataSaver();
  const [started, setStarted] = useState(startImmediately);
  const [awake, setAwake] = useState(true);
  const [activity, setActivity] = useState(0);
  const [scrubbing, setScrubbing] = useState(false);
  const [skipHint, setSkipHint] = useState<'back' | 'forward' | null>(null);
  const lastWake = useRef(0);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTap = useRef<{ at: number; side: 'back' | 'forward' } | null>(null);
  const pointerType = useRef('mouse');

  const state = useVideoControls({ active: started, hls, src, maxHeight: maxVideoHeight, autoPlay: !startImmediately });
  const { video, container } = state;
  const pinned = !state.playing || scrubbing || state.waiting;
  const visible = pinned || awake;

  // Commandes visibles à la moindre activité (souris, clavier, toucher, bouton), masquées après
  // 2,5 s de lecture sans geste. Les mouvements de souris rapprochés comptent pour un seul.
  const wake = (throttled = false) => {
    const now = Date.now();
    if (throttled && now - lastWake.current < 250) return;
    lastWake.current = now;
    setAwake(true);
    setActivity((count) => count + 1);
  };
  useEffect(() => {
    if (pinned) return;
    const timer = setTimeout(() => setAwake(false), HIDE_AFTER_MS);
    return () => clearTimeout(timer);
  }, [pinned, activity]);
  useEffect(
    () => () => {
      for (const timer of [tapTimer.current, hintTimer.current]) if (timer) clearTimeout(timer);
    },
    [],
  );

  const skip = (side: 'back' | 'forward') => {
    state.seekBy(side === 'back' ? -SKIP_SECONDS : SKIP_SECONDS);
    setSkipHint(side);
    if (hintTimer.current) clearTimeout(hintTimer.current);
    hintTimer.current = setTimeout(() => setSkipHint(null), 500);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.target instanceof HTMLInputElement || event.altKey || event.ctrlKey || event.metaKey) return;
    const element = video.current;
    const key = event.key.toLowerCase();
    let handled = true;
    if (key === ' ' || key === 'k') state.toggle();
    else if (key === 'j') skip('back');
    else if (key === 'l') skip('forward');
    else if (key === 'arrowleft') state.seekBy(-5);
    else if (key === 'arrowright') state.seekBy(5);
    else if (key === 'arrowup') state.setVolume((element?.volume ?? 1) + 0.1);
    else if (key === 'arrowdown') state.setVolume((element?.volume ?? 1) - 0.1);
    else if (key === 'm') state.toggleMute();
    else if (key === 'f') state.toggleFullscreen();
    else if (/^[0-9]$/.test(key)) state.seekTo((Number(key) / 10) * state.duration);
    else handled = false;
    if (handled) {
      event.preventDefault();
      wake();
    }
  };

  // Souris : clic = lecture/pause, double clic = plein écran. Doigt : toucher = commandes,
  // double toucher sur un côté = ±10 s.
  const onSurfacePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse') return;
    const rect = event.currentTarget.getBoundingClientRect();
    const side = event.clientX - rect.left < rect.width / 2 ? 'back' : 'forward';
    const now = Date.now();
    const previous = lastTap.current;
    if (previous && previous.side === side && now - previous.at < DOUBLE_TAP_MS) {
      if (tapTimer.current) clearTimeout(tapTimer.current);
      lastTap.current = null;
      skip(side);
      wake();
      return;
    }
    lastTap.current = { at: now, side };
    if (tapTimer.current) clearTimeout(tapTimer.current);
    tapTimer.current = setTimeout(() => {
      if (visible && !pinned) setAwake(false);
      else wake();
    }, DOUBLE_TAP_MS);
  };

  return (
    <div
      ref={container}
      tabIndex={started ? 0 : -1}
      onKeyDown={started ? onKeyDown : undefined}
      onPointerMove={(event) => {
        if (started && event.pointerType === 'mouse') wake(true);
      }}
      onClickCapture={() => {
        if (started) wake();
      }}
      onMouseLeave={() => {
        if (!pinned) setAwake(false);
      }}
      aria-label="Lecteur vidéo"
      role="region"
      className={cn(
        // mx-auto : avec aspect-ratio, max-height réduit aussi la largeur (vidéo portrait) ; le lecteur reste centré.
        'group/player relative mx-auto overflow-hidden rounded border border-line bg-black outline-none select-none focus-visible:ring-2 focus-visible:ring-primary',
        started && !visible && 'cursor-none',
        className,
      )}
      style={{ aspectRatio, maxHeight }}
    >
      <video ref={video} poster={poster} playsInline preload={startImmediately ? 'metadata' : 'none'} className="size-full object-contain" />

      {started ? (
        <>
          <div
            className="absolute inset-0"
            onPointerDown={(event) => {
              pointerType.current = event.pointerType;
            }}
            onClick={() => {
              if (pointerType.current === 'mouse') state.toggle();
            }}
            onDoubleClick={() => {
              if (pointerType.current === 'mouse') state.toggleFullscreen();
            }}
            onPointerUp={onSurfacePointerUp}
          />
          {skipHint ? (
            <div
              className={cn(
                'pointer-events-none absolute top-1/2 flex size-16 -translate-y-1/2 flex-col items-center justify-center rounded-full bg-black/50 text-label-sm font-semibold text-white',
                skipHint === 'back' ? 'left-6' : 'right-6',
              )}
            >
              {skipHint === 'back' ? `-${SKIP_SECONDS} s` : `+${SKIP_SECONDS} s`}
            </div>
          ) : null}
          <VideoControls state={state} visible={visible} onScrub={setScrubbing} />
        </>
      ) : (
        <button
          type="button"
          onClick={() => {
            setStarted(true);
            requestAnimationFrame(() => container.current?.focus({ preventScroll: true }));
          }}
          className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/30 text-white"
        >
          <span className="flex size-16 items-center justify-center rounded-full bg-primary shadow-lg transition-transform hover:scale-105">
            <Play className="size-7 fill-current" aria-hidden />
          </span>
          <span className="text-body-md font-semibold">Lire la vidéo</span>
          <span className="font-mono text-label-sm text-white/80">
            Pas de lecture automatique · {durationSeconds ? formatTime(durationSeconds) : 'vidéo courte'}
          </span>
        </button>
      )}
    </div>
  );
}
