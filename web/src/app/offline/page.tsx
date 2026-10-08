import { CloudOff } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { buttonClasses, LogoMark } from '@/shared/ui';

export const metadata: Metadata = { title: 'Hors ligne' };

/** Page de secours du service worker : affichée quand une page jamais visitée est demandée hors ligne. */
export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <LogoMark size={48} />
      <CloudOff className="size-10 text-offline" aria-hidden />
      <h1 className="text-headline-lg">Vous êtes hors ligne</h1>
      <p className="text-body-md text-ink-muted">
        Cette page n&apos;a pas encore été enregistrée sur votre appareil. Les pages déjà visitées,
        votre coffre de snippets et vos brouillons restent disponibles.
      </p>
      {/* Sans préchargement : hors ligne il échouerait, et en ligne il ajouterait ~280 Ko de JS
          d'autres pages au budget data de cette page (e2e/low-network.spec.ts). */}
      <div className="flex flex-wrap justify-center gap-2">
        <Link href="/snippets" prefetch={false} className={buttonClasses()}>
          Mon coffre
        </Link>
        <Link href="/feed" prefetch={false} className={buttonClasses({ variant: 'ghost' })}>
          Le fil
        </Link>
      </div>
    </main>
  );
}
