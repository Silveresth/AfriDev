'use client';

import { BellRing, X } from 'lucide-react';
import { useState } from 'react';

import { useSession } from '@/shared/session';

import { useWebPush } from './webPush';

const DISMISSED_KEY = 'afridev:push-banner-dismissed';

function readDismissed(): boolean {
  try {
    return window.localStorage.getItem(DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Invitation à activer les notifications de ce navigateur (messages, mentions, réponses), tant
 * qu'elles ne sont ni actives ni refusées. Fermée une fois, elle ne revient pas.
 */
export function EnablePushBanner() {
  const { isAuthenticated } = useSession();
  const push = useWebPush();
  const [dismissed, setDismissed] = useState(() => (typeof window === 'undefined' ? true : readDismissed()));
  if (!isAuthenticated || dismissed || push.status !== 'off') return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      window.localStorage.setItem(DISMISSED_KEY, '1');
    } catch {
      // stockage indisponible (navigation privée) : la bannière reviendra simplement
    }
  };

  return (
    <div className="mb-5 flex items-center gap-3 rounded-2xl border border-primary/20 bg-primary-soft/60 px-4 py-3">
      <BellRing className="size-5 shrink-0 text-primary-ink" aria-hidden />
      <p className="min-w-0 flex-1 text-body-sm text-ink">
        Activez les notifications pour être prévenu des messages, mentions et réponses, même quand le site est fermé.
      </p>
      <button
        type="button"
        onClick={() => void push.enable().then(dismiss)}
        disabled={push.busy}
        className="h-8 shrink-0 rounded-lg bg-primary px-3 text-body-sm font-semibold text-on-primary disabled:opacity-60"
      >
        Activer
      </button>
      <button type="button" onClick={dismiss} aria-label="Plus tard" className="flex size-8 shrink-0 items-center justify-center rounded-lg text-ink-muted hover:bg-container">
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );
}
