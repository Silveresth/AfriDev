'use client';

import { RefreshCw } from 'lucide-react';

import { buttonClasses } from '@/shared/ui';

/** Recharge la page demandée (l'adresse n'a pas changé : seul le contenu de secours s'affiche). */
export function RetryButton() {
  return (
    <button type="button" onClick={() => window.location.reload()} className={buttonClasses({ variant: 'ghost' })}>
      <RefreshCw className="size-4" aria-hidden /> Réessayer
    </button>
  );
}
