'use client';

import { CloudOff, RefreshCw, Wifi, X } from 'lucide-react';
import { useEffect, useState } from 'react';

import { useIsClient } from '@/shared/hooks';
import { cn } from '@/shared/lib';

import { flushOutbox } from './outbox';
import { useNetworkQuality } from './useNetworkStatus';
import { useOutbox } from './useOutbox';

type Popup = 'offline' | 'online';

/** Durée d'affichage : un peu plus longue pour la perte de réseau, l'info importante. */
const DURATION: Record<Popup, number> = { offline: 6000, online: 3500 };

/**
 * Pastille de connectivité, centrée en haut de l'écran : elle apparaît quand le réseau se perd
 * ou revient, puis s'efface d'elle-même (ou d'un clic). L'état permanent reste visible dans la
 * barre latérale ; aucune bande n'occupe la page.
 */
export function ConnectivityStrip() {
  const isClient = useIsClient();
  const network = useNetworkQuality();
  const pending = useOutbox().length;
  const [popup, setPopup] = useState<Popup | null>(null);
  // Changement de réseau détecté pendant le rendu (motif React « état dérivé d'une prop »).
  const [seen, setSeen] = useState(network);
  if (seen !== network) {
    setSeen(network);
    if (network === 'offline') setPopup('offline');
    else if (seen === 'offline') setPopup('online');
  }

  useEffect(() => {
    if (!popup) return;
    const timer = window.setTimeout(() => setPopup(null), DURATION[popup]);
    return () => window.clearTimeout(timer);
  }, [popup]);

  if (!isClient || !popup) return null;

  const offline = popup === 'offline';
  const Icon = offline ? CloudOff : Wifi;
  const message = offline
    ? pending
      ? `Hors ligne · ${pending} élément${pending > 1 ? 's' : ''} en attente d'envoi`
      : 'Hors ligne · vos modifications restent sur cet appareil'
    : pending
      ? `De retour en ligne · envoi de ${pending} élément${pending > 1 ? 's' : ''}…`
      : 'De retour en ligne';

  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[60] flex justify-center px-4">
      <div
        role="status"
        aria-live="polite"
        className={cn(
          'pointer-events-auto flex max-w-full items-center gap-2 rounded-full py-1.5 pr-1.5 pl-3.5 text-body-sm font-medium shadow-raised',
          offline ? 'bg-ink text-shell' : 'bg-secondary text-white',
        )}
      >
        <Icon className="size-4 shrink-0" aria-hidden />
        <span className="truncate">{message}</span>
        {!offline && pending > 0 ? (
          <button
            type="button"
            onClick={() => void flushOutbox()}
            className="flex shrink-0 items-center gap-1 rounded-full px-2 py-1 hover:bg-white/15"
          >
            <RefreshCw className="size-3.5" aria-hidden /> Réessayer
          </button>
        ) : null}
        <button
          type="button"
          aria-label="Fermer"
          onClick={() => setPopup(null)}
          className="flex size-7 shrink-0 items-center justify-center rounded-full opacity-80 hover:bg-white/15 hover:opacity-100"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}
