'use client';
import { useEffect } from 'react';

import { DataSaverSync } from '@/shared/data-saver';
import { LangProvider } from '@/shared/i18n';
import { OutboxSync, PowerSyncProvider } from '@/shared/offline';
import { QueryProvider } from '@/shared/query';
import { SessionProvider } from '@/shared/session';
import { ThemeSync } from '@/shared/theme';
import { ToastProvider } from '@/shared/ui';

/** Fournisseurs communs à toutes les pages (cache local, session, hors ligne, préférences). */
export function AppProviders({ children }: { children: React.ReactNode }) {
  // Mise à jour automatique et purge transparente des anciens caches Service Worker
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then((reg) => {
        if (reg) void reg.update();
      });
    }
    if ('caches' in window) {
      void caches.keys().then((keys) => {
        const legacyCaches = ['apis', 'pages', 'pages-rsc', 'pages-rsc-prefetch', 'others', 'cross-origin'];
        for (const key of keys) {
          if (legacyCaches.includes(key)) {
            void caches.delete(key);
          }
        }
      });
    }
  }, []);
  return (
    <QueryProvider>
      <SessionProvider>
        <PowerSyncProvider>
          <ToastProvider>
            <LangProvider>
              <ThemeSync />
              <DataSaverSync />
              <OutboxSync />
              {children}
            </LangProvider>
          </ToastProvider>
        </PowerSyncProvider>
      </SessionProvider>
    </QueryProvider>
  );
}
