'use client';

import { CloudOff, RefreshCw, Wifi, X } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

import { useIsClient } from '@/shared/hooks';
import { cn } from '@/shared/lib';

import { flushOutbox } from './outbox';
import { useIsOnline } from './useNetworkStatus';
import { useOutbox } from './useOutbox';

type Popup = 'offline' | 'online';

/** Durée d'affichage de la bannière, hors ligne comme au retour du réseau. */
const DURATION = 5000;

/**
 * Bannière de connectivité, centrée en haut de l'écran, 5 secondes :
 * - hors ligne : à chaque page ouverte (et dès la perte du réseau), « Vous êtes en mode hors ligne » ;
 * - au retour du réseau : « De retour en ligne » (et l'envoi des éléments en attente).
 * Montée une seule fois pour toute l'application (AppProviders).
 */
export function ConnectivityStrip() {
  const isClient = useIsClient();
  const online = useIsOnline();
  const pathname = usePathname();
  const pending = useOutbox().length;
  const [popup, setPopup] = useState<Popup | null>(null);
  // Réseau ou page qui change (motif React « état dérivé d'une prop », sans effet).
  const [seen, setSeen] = useState<{ online: boolean; pathname: string } | null>(null);
  if (isClient && (seen?.online !== online || seen.pathname !== pathname)) {
    setSeen({ online, pathname });
    if (!online) setPopup('offline');
    else if (seen && !seen.online) setPopup('online');
  }

  useEffect(() => {
    if (!popup) return;
    const timer = window.setTimeout(() => setPopup(null), DURATION);
    return () => window.clearTimeout(timer);
  }, [popup, pathname]);

  if (!isClient || !popup) return null;

  const offline = popup === 'offline';
  const Icon = offline ? CloudOff : Wifi;
  const message = offline
    ? 'Vous êtes en mode hors ligne'
    : pending
      ? `De retour en ligne · envoi de ${pending} élément${pending > 1 ? 's' : ''}…`
      : 'De retour en ligne';

  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[60] flex justify-center px-4">
      <div
        role="status"
        aria-live="polite"
        className={cn(
          'animate-pop pointer-events-auto flex max-w-full items-center gap-2 rounded-full py-1.5 pr-1.5 pl-3.5 text-body-sm font-medium shadow-raised',
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
