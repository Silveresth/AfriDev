'use client';

import { DataSaverSync } from '@/shared/data-saver';
import { LangProvider } from '@/shared/i18n';
import { OutboxSync, PowerSyncProvider } from '@/shared/offline';
import { QueryProvider } from '@/shared/query';
import { SessionProvider } from '@/shared/session';
import { ThemeSync } from '@/shared/theme';
import { ToastProvider } from '@/shared/ui';

/** Fournisseurs communs à toutes les pages (cache local, session, hors ligne, préférences). */
export function AppProviders({ children }: { children: React.ReactNode }) {
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
