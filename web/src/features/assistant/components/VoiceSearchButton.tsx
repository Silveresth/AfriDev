'use client';

import { Loader2, Mic, Square } from 'lucide-react';
import { useRef, useState } from 'react';

import { errorMessage } from '@/shared/api';
import { cn } from '@/shared/lib';
import { uploadMedia } from '@/shared/media';

import { useVoiceSearch } from '../api';

export interface VoiceResult {
  text: string;
  query: string;
  scope: string;
  filters: Record<string, string>;
}

/** « Montre-moi les jobs Django à distance au Sénégal » : dicté, compris, puis recherché. */
export function VoiceSearchButton({ onResult, className }: { onResult: (result: VoiceResult) => void; className?: string }) {
  const search = useVoiceSearch();
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const busy = search.isPending;

  async function start() {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('Micro indisponible sur ce navigateur.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : '';
      const rec = new MediaRecorder(stream, { mimeType: mimeType || undefined, audioBitsPerSecond: 24_000 });
      const chunks: Blob[] = [];
      rec.ondataavailable = (event) => chunks.push(event.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        setRecording(false);
        const type = (rec.mimeType || 'audio/webm').split(';')[0] ?? 'audio/webm';
        try {
          const asset = await uploadMedia(new File([new Blob(chunks, { type })], 'recherche.webm', { type }), 'audio');
          onResult(await search.mutateAsync({ mediaId: asset.id, language: 'fr' }));
        } catch (e) {
          setError(errorMessage(e));
        }
      };
      recorder.current = rec;
      rec.start();
      setRecording(true);
      // 15 s suffisent pour une recherche.
      window.setTimeout(() => rec.state === 'recording' && rec.stop(), 15_000);
    } catch {
      setError('Accès au micro refusé.');
    }
  }

  return (
    <span className={cn('relative inline-flex', className)}>
      <button
        type="button"
        onClick={() => (recording ? recorder.current?.stop() : void start())}
        disabled={busy}
        aria-label={recording ? 'Arrêter et rechercher' : 'Rechercher à la voix'}
        title={recording ? 'Arrêter et rechercher' : 'Rechercher à la voix'}
        className={cn(
          'flex size-12 items-center justify-center rounded-full text-on-primary transition-colors disabled:opacity-60',
          recording ? 'animate-pulse bg-danger' : 'bg-primary hover:opacity-90',
        )}
      >
        {busy ? <Loader2 className="size-5 animate-spin" aria-hidden /> : recording ? <Square className="size-4 fill-current" aria-hidden /> : <Mic className="size-5" aria-hidden />}
      </button>
      {error ? <span className="absolute top-full right-0 mt-1 w-56 text-right text-label-md text-danger">{error}</span> : null}
    </span>
  );
}
