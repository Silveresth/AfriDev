'use client';

import { Gauge, Maximize, Minimize, Pause, PictureInPicture2, Play, RefreshCw, RotateCcw, RotateCw, Volume1, Volume2, VolumeX } from 'lucide-react';
import { useState } from 'react';

import { cn } from '@/shared/lib';

import { formatTime, SKIP_SECONDS, SPEEDS } from './format';
import { SeekBar } from './SeekBar';
import type { VideoControlsState } from './useVideoControls';

/** Barre du bas et boutons centraux du lecteur. `visible` : affichée (souris active, pause…). */
export function VideoControls({
  state,
  visible,
  onScrub,
}: {
  state: VideoControlsState;
  visible: boolean;
  onScrub: (active: boolean) => void;
}) {
  const [speedOpen, setSpeedOpen] = useState(false);
  const VolumeIcon = state.muted || state.volume === 0 ? VolumeX : state.volume < 0.5 ? Volume1 : Volume2;
  const CenterIcon = state.ended ? RotateCcw : state.playing ? Pause : Play;
  const centerLabel = state.ended ? 'Revoir' : state.playing ? 'Pause (k)' : 'Lecture (k)';

  if (state.failed) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/60 text-white">
        <p className="text-body-sm">Lecture impossible. Vérifiez votre connexion.</p>
        <button type="button" onClick={state.retry} className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-body-sm font-semibold">
          <RefreshCw className="size-4" aria-hidden /> Réessayer
        </button>
      </div>
    );
  }

  return (
    <>
      {state.waiting ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="size-12 animate-spin rounded-full border-4 border-white/30 border-t-white" aria-label="Chargement" />
        </div>
      ) : null}

      <div
        className={cn(
          'pointer-events-none absolute inset-0 flex items-center justify-center gap-8 transition-opacity duration-200',
          visible && !state.waiting ? 'opacity-100' : 'opacity-0',
        )}
      >
        <RoundButton label={`Reculer de ${SKIP_SECONDS} s (j)`} onClick={() => state.seekBy(-SKIP_SECONDS)} visible={visible}>
          <RotateCcw className="size-5" aria-hidden />
          <span className="absolute text-[8px] font-extrabold">{SKIP_SECONDS}</span>
        </RoundButton>
        <RoundButton label={centerLabel} onClick={state.toggle} visible={visible} primary>
          <CenterIcon className={cn('size-7', !state.playing && !state.ended && 'fill-current')} aria-hidden />
        </RoundButton>
        <RoundButton label={`Avancer de ${SKIP_SECONDS} s (l)`} onClick={() => state.seekBy(SKIP_SECONDS)} visible={visible}>
          <RotateCw className="size-5" aria-hidden />
          <span className="absolute text-[8px] font-extrabold">{SKIP_SECONDS}</span>
        </RoundButton>
      </div>

      <div
        className={cn(
          'absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-3 pt-10 pb-2 text-white transition-opacity duration-200',
          visible ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={(event) => event.stopPropagation()}
        onDoubleClick={(event) => event.stopPropagation()}
      >
        <SeekBar current={state.currentTime} buffered={state.buffered} duration={state.duration} onSeek={state.seekTo} onScrub={onScrub} />
        <div className="mt-1 flex items-center gap-1">
          <ToolButton label={state.playing ? 'Pause (k)' : 'Lecture (k)'} onClick={state.toggle}>
            {state.playing ? <Pause className="size-5" aria-hidden /> : <Play className="size-5 fill-current" aria-hidden />}
          </ToolButton>
          <div className="group/volume flex items-center">
            <ToolButton label={state.muted ? 'Activer le son (m)' : 'Couper le son (m)'} onClick={state.toggleMute}>
              <VolumeIcon className="size-5" aria-hidden />
            </ToolButton>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={state.muted ? 0 : state.volume}
              onChange={(event) => state.setVolume(Number(event.target.value))}
              aria-label="Volume"
              className="h-1 w-0 cursor-pointer accent-primary opacity-0 transition-all group-focus-within/volume:w-20 group-focus-within/volume:opacity-100 group-hover/volume:w-20 group-hover/volume:opacity-100"
            />
          </div>
          <span className="ml-1 font-mono text-label-sm tabular-nums text-white/90">
            {formatTime(state.currentTime)} / {formatTime(state.duration)}
          </span>
          <span className="flex-1" />
          <div className="relative">
            <ToolButton label="Vitesse de lecture" onClick={() => setSpeedOpen((open) => !open)} expanded={speedOpen}>
              {state.rate === 1 ? <Gauge className="size-5" aria-hidden /> : <span className="font-mono text-label-sm font-bold">{state.rate}×</span>}
            </ToolButton>
            {speedOpen ? (
              <ul role="menu" className="absolute right-0 bottom-11 z-10 min-w-24 overflow-hidden rounded-lg bg-black/90 py-1 text-body-sm shadow-xl">
                {SPEEDS.map((speed) => (
                  <li key={speed}>
                    <button
                      type="button"
                      role="menuitemradio"
                      aria-checked={state.rate === speed}
                      onClick={() => {
                        state.setRate(speed);
                        setSpeedOpen(false);
                      }}
                      className={cn('w-full px-4 py-1.5 text-left hover:bg-white/15', state.rate === speed && 'font-bold text-primary')}
                    >
                      {speed === 1 ? 'Normale' : `${speed}×`}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          {state.pipSupported ? (
            <ToolButton label="Image dans l’image" onClick={state.togglePip} pressed={state.pip}>
              <PictureInPicture2 className="size-5" aria-hidden />
            </ToolButton>
          ) : null}
          <ToolButton label={state.fullscreen ? 'Quitter le plein écran (f)' : 'Plein écran (f)'} onClick={state.toggleFullscreen}>
            {state.fullscreen ? <Minimize className="size-5" aria-hidden /> : <Maximize className="size-5" aria-hidden />}
          </ToolButton>
        </div>
      </div>
    </>
  );
}

function RoundButton({
  label,
  onClick,
  visible,
  primary,
  children,
}: {
  label: string;
  onClick: () => void;
  visible: boolean;
  primary?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      tabIndex={visible ? 0 : -1}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      onDoubleClick={(event) => event.stopPropagation()}
      className={cn(
        'relative flex items-center justify-center rounded-full text-white transition-transform hover:scale-105 active:scale-95',
        visible ? 'pointer-events-auto' : 'pointer-events-none',
        primary ? 'size-16 bg-primary shadow-lg' : 'size-12 bg-black/50 backdrop-blur-sm',
      )}
    >
      {children}
    </button>
  );
}

function ToolButton({
  label,
  onClick,
  pressed,
  expanded,
  children,
}: {
  label: string;
  onClick: () => void;
  pressed?: boolean;
  expanded?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      aria-expanded={expanded}
      onClick={onClick}
      className="flex size-9 items-center justify-center rounded-full transition-colors hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
    >
      {children}
    </button>
  );
}
