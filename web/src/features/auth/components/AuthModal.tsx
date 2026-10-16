'use client';

import { X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { useSession } from '@/shared/session';

import { type AuthResponse, completeAuth } from '../api';
import { type AuthMode, AuthPanel } from './AuthPanel';
import { AuthShowcase } from './AuthShowcase';

export type AuthModalMode = AuthMode;

/** Connexion sans quitter la page (bouton « Se connecter » de l'en-tête, action protégée). */
export function AuthModal({ open, onClose, initialMode = 'login' }: { open: boolean; onClose: () => void; initialMode?: AuthMode }) {
  const router = useRouter();
  const { signIn } = useSession();
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [lastInitial, setLastInitial] = useState(initialMode);
  if (initialMode !== lastInitial) {
    setLastInitial(initialMode);
    setMode(initialMode);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const onAuthenticated = (response: AuthResponse) => {
    const done = completeAuth(response, signIn);
    onClose();
    // Nouveau compte : l'assistant d'accueil s'ouvre de lui-même (needs_onboarding).
    if (!done) router.push('/verify-2fa');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/75 p-3 backdrop-blur-md sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={mode === 'login' ? 'Connexion' : 'Inscription'}
        onClick={(event) => event.stopPropagation()}
        className="animate-pop relative flex max-h-[92dvh] w-full max-w-4xl overflow-hidden rounded-3xl border border-line bg-card shadow-2xl"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer"
          className="absolute top-4 right-4 z-20 flex size-9 items-center justify-center rounded-full bg-container-low text-ink-muted transition-colors hover:bg-container hover:text-ink"
        >
          <X className="size-4" aria-hidden />
        </button>
        <AuthShowcase mode={mode} />
        <AuthPanel mode={mode} onModeChange={setMode} onAuthenticated={onAuthenticated} />
      </div>
    </div>
  );
}
