'use client';

import { useEffect } from 'react';

import { useLocalPreference } from '@/shared/hooks';
import { useNetworkQuality } from '@/shared/offline/useNetworkStatus';
import { TEXT_ONLY_KEY } from '@/shared/theme';

export type TextOnlyMode = 'auto' | 'on' | 'off';
export type VideoQuality = 'auto' | '240' | '480' | '720';

/**
 * Économie de données :
 * - « Texte seul » : polices système, images et vidéos remplacées par un aperçu à toucher ;
 *   en « auto », activé dès que le réseau est lent (2G/3G) ou que l'en-tête Save-Data est actif ;
 * - qualité vidéo plafonnée ; pas de lecture automatique sur réseau lent.
 */
export function useDataSaver() {
  const [mode, setMode] = useLocalPreference<TextOnlyMode>(TEXT_ONLY_KEY, 'auto');
  const [videoQuality, setVideoQuality] = useLocalPreference<VideoQuality>(
    'afridev.video-quality',
    'auto',
  );
  const network = useNetworkQuality();
  const textOnly = mode === 'on' || (mode === 'auto' && network === 'slow');
  const maxVideoHeight =
    videoQuality === 'auto' ? (network === 'good' ? 720 : 240) : Number(videoQuality);
  return { mode, setMode, textOnly, videoQuality, setVideoQuality, maxVideoHeight, network };
}

/** Reflète le mode « Texte seul » sur <html data-text-only> (lu par le CSS). */
export function DataSaverSync() {
  const { textOnly } = useDataSaver();
  useEffect(() => {
    document.documentElement.toggleAttribute('data-text-only', textOnly);
  }, [textOnly]);
  return null;
}
