'use client';

import { useEffect, useState } from 'react';

export interface StorageEstimate {
  usage: number;
  quota: number;
}

/** Espace réellement occupé par la copie locale (cache, brouillons, service worker). */
export function useStorageEstimate(refreshKey = 0): StorageEstimate | null {
  const [estimate, setEstimate] = useState<StorageEstimate | null>(null);
  useEffect(() => {
    if (!navigator.storage?.estimate) return;
    void navigator.storage.estimate().then(({ usage = 0, quota = 0 }) => setEstimate({ usage, quota }));
  }, [refreshKey]);
  return estimate;
}
