'use client';

import { useSyncExternalStore } from 'react';

export type NetworkQuality = 'offline' | 'slow' | 'good';

interface NetworkInformation extends EventTarget {
  saveData?: boolean;
  effectiveType?: 'slow-2g' | '2g' | '3g' | '4g';
}

function connection(): NetworkInformation | undefined {
  return (navigator as Navigator & { connection?: NetworkInformation }).connection;
}

function subscribe(callback: () => void) {
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  connection()?.addEventListener('change', callback);
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
    connection()?.removeEventListener('change', callback);
  };
}

export function useIsOnline(): boolean {
  return useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
}

/** Qualité du réseau (Network Information API, absente de Safari/Firefox : « good » par défaut). */
export function useNetworkQuality(): NetworkQuality {
  return useSyncExternalStore(
    subscribe,
    () => {
      if (!navigator.onLine) return 'offline';
      const info = connection();
      return info && (info.saveData || ['slow-2g', '2g', '3g'].includes(info.effectiveType ?? ''))
        ? 'slow'
        : 'good';
    },
    () => 'good',
  );
}
