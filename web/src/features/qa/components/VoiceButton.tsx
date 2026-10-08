'use client';

import { Mic, Square } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { errorMessage } from '@/shared/api';
import { cn } from '@/shared/lib';
import { Spinner, StatusBadge } from '@/shared/ui';

import { transcribeVoice } from '../api';

const MAX_SECONDS = 120;

/** « Poser à la voix » : enregistrement Opus, transcription Whisper, texte inséré dans l'éditeur. */
export function VoiceButton({ onTranscript }: { onTranscript: (text: string, mediaId: string) => void }) {
  const [state, setState] = useState<'idle' | 'recording' | 'transcribing'>('idle');
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);

  useEffect(() => {
    if (state !== 'recording') return;
    const timer = window.setInterval(() => {
      setSeconds((value) => {
        if (value + 1 >= MAX_SECONDS) recorder.current?.stop();
        return value + 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [state]);

  async function start() {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError("L'enregistrement audio n'est pas disponible sur ce navigateur.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : '';
      // Voix mono à faible débit : quelques Ko par seconde.
      const rec = new MediaRecorder(stream, { mimeType: mimeType || undefined, audioBitsPerSecond: 24_000 });
      const chunks: Blob[] = [];
      rec.ondataavailable = (event) => chunks.push(event.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        setState('transcribing');
        try {
          const { text, mediaId } = await transcribeVoice(new Blob(chunks, { type: rec.mimeType }));
          onTranscript(text, mediaId);
        } catch (e) {
          setError(errorMessage(e));
        } finally {
          setState('idle');
        }
      };
      recorder.current = rec;
      rec.start();
      setSeconds(0);
      setState('recording');
    } catch {
      setError('Accès au micro refusé.');
    }
  }

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={() => (state === 'recording' ? recorder.current?.stop() : start())}
        disabled={state === 'transcribing'}
        className={cn(
          'inline-flex min-h-11 items-center gap-2 rounded-lg border px-3 text-body-sm font-semibold transition-colors',
          state === 'recording' ? 'border-danger bg-danger-soft text-on-danger-soft' : 'border-line bg-card text-ink hover:bg-container',
        )}
      >
        {state === 'recording' ? (
          <>
            <Square className="size-4 fill-current" aria-hidden /> Arrêter · {Math.floor(seconds / 60)}:
            {String(seconds % 60).padStart(2, '0')}
          </>
        ) : state === 'transcribing' ? (
          <>
            <Spinner /> Transcription…
          </>
        ) : (
          <>
            <span className="size-2 rounded-full bg-danger" aria-hidden />
            <Mic className="size-4" aria-hidden /> Poser à la voix
            <StatusBadge tone="success" dot={false}>~3 Ko/s</StatusBadge>
          </>
        )}
      </button>
      {error ? <p role="alert" className="text-body-sm text-danger">{error}</p> : null}
    </div>
  );
}
