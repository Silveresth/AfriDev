import { useState } from 'react';

import { type VoiceResult, voiceSearch } from '@/features/assistant/api';
import { useVoiceRecorder } from '@/features/messaging/media';
import { errorMessage } from '@/shared/api';
import { currentLocale } from '@/shared/i18n';

/** Recherche dictée : enregistrer, envoyer, laisser l'IA comprendre la demande. */
export function useVoiceSearch({ onResult }: { onResult: (result: VoiceResult) => void }) {
  const recorder = useVoiceRecorder();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    setError(null);
    try {
      await recorder.start();
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  const stop = async () => {
    setBusy(true);
    try {
      const uri = await recorder.stop();
      if (!uri) return;
      const mediaId = await recorder.upload(uri);
      onResult(await voiceSearch(mediaId, currentLocale().slice(0, 2)));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return { recording: recorder.recording, busy, error, start, stop };
}
