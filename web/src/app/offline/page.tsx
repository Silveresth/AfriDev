import { CloudOff } from 'lucide-react';
import type { Metadata } from 'next';

import { RetryButton } from './RetryButton';

export const metadata: Metadata = { title: 'Mode hors ligne' };

/** Page de secours du service worker : une page jamais visitée, demandée sans réseau. */
export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <CloudOff className="size-10 text-offline" aria-hidden />
      <h1 className="text-headline-lg">Mode hors ligne</h1>
      <RetryButton />
    </main>
  );
}
