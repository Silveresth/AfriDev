'use client';

import { useRef, useState } from 'react';

import { formatTime } from './format';

/**
 * Barre de progression : lu, tampon, curseur et bulle du temps visé au survol. Clic ou glissement
 * (souris, doigt) ; flèches du clavier quand elle a le focus (gérées par le lecteur).
 */
export function SeekBar({
  current,
  buffered,
  duration,
  onSeek,
  onScrub,
}: {
  current: number;
  buffered: number;
  duration: number;
  onSeek: (seconds: number) => void;
  onScrub?: (active: boolean) => void;
}) {
  const bar = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);

  const ratioAt = (clientX: number) => {
    const rect = bar.current?.getBoundingClientRect();
    return rect && rect.width ? Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)) : 0;
  };
  const played = drag ?? (duration ? current / duration : 0);
  const loaded = duration ? Math.min(1, buffered / duration) : 0;

  return (
    <div
      ref={bar}
      role="slider"
      tabIndex={0}
      aria-label="Position dans la vidéo"
      aria-valuemin={0}
      aria-valuemax={Math.round(duration)}
      aria-valuenow={Math.round(played * duration)}
      aria-valuetext={`${formatTime(played * duration)} sur ${formatTime(duration)}`}
      className="group/seek relative flex h-4 cursor-pointer touch-none items-center outline-none"
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        onScrub?.(true);
        setDrag(ratioAt(event.clientX));
      }}
      onPointerMove={(event) => {
        const ratio = ratioAt(event.clientX);
        setHover(ratio);
        if (drag !== null) setDrag(ratio);
      }}
      onPointerUp={(event) => {
        if (drag === null) return;
        onSeek(ratioAt(event.clientX) * duration);
        setDrag(null);
        onScrub?.(false);
      }}
      onPointerCancel={() => {
        setDrag(null);
        onScrub?.(false);
      }}
      onPointerLeave={() => setHover(null)}
    >
      <div className="relative h-1 w-full overflow-hidden rounded-full bg-white/25 transition-[height] group-hover/seek:h-1.5">
        <div className="absolute inset-y-0 left-0 bg-white/45" style={{ width: `${loaded * 100}%` }} />
        <div className="absolute inset-y-0 left-0 bg-primary" style={{ width: `${played * 100}%` }} />
      </div>
      <div
        className="pointer-events-none absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary shadow transition-transform group-hover/seek:scale-110 group-focus-visible/seek:ring-2 group-focus-visible/seek:ring-white"
        style={{ left: `${played * 100}%` }}
      />
      {hover !== null && duration ? (
        <span
          className="pointer-events-none absolute bottom-5 -translate-x-1/2 rounded bg-black/80 px-1.5 py-0.5 font-mono text-label-sm text-white"
          style={{ left: `${hover * 100}%` }}
        >
          {formatTime(hover * duration)}
        </span>
      ) : null}
    </div>
  );
}
