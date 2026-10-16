'use client';

import { X } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect } from 'react';

import { useSession } from '@/shared/session';

import { afterLogin, type AuthResponse, completeAuth } from '../api';
import { type AuthMode, AuthPanel } from './AuthPanel';
import { AuthShowcase } from './AuthShowcase';

/** Pages /login et /register (même écran ; ?mode=register bascule sur l'inscription). */
export function LoginScreen({ initialMode = 'login' }: { initialMode?: AuthMode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signIn, isAuthenticated } = useSession();
  const modeParam = searchParams.get('mode');
  const mode: AuthMode = modeParam === 'register' || modeParam === 'login' ? modeParam : initialMode;

  useEffect(() => {
    afterLogin.set(searchParams.get('next'));
  }, [searchParams]);

  // Connecté (ici ou dans un autre onglet) : direction la page demandée. Un nouveau compte
  // y trouvera l'assistant d'accueil (needs_onboarding), quelle que soit la méthode utilisée.
  useEffect(() => {
    if (isAuthenticated) router.replace(afterLogin.take());
  }, [isAuthenticated, router]);

  const close = useCallback(() => {
    if (window.history.length > 1) router.back();
    else router.push('/');
  }, [router]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close]);

  const switchMode = (next: AuthMode) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next === 'register') params.set('mode', 'register');
    else params.delete('mode');
    router.replace(params.size ? `?${params}` : window.location.pathname);
  };

  const onAuthenticated = (response: AuthResponse) => {
    if (!completeAuth(response, signIn)) router.push('/verify-2fa');
  };

  return (
    <div className="relative flex max-h-[94dvh] w-full overflow-hidden rounded-3xl border border-line bg-card shadow-2xl">
      <button
        type="button"
        onClick={close}
        aria-label="Fermer"
        className="absolute top-4 right-4 z-20 flex size-9 items-center justify-center rounded-full bg-container-low text-ink-muted transition-colors hover:bg-container hover:text-ink"
      >
        <X className="size-4" aria-hidden />
      </button>
      <AuthShowcase mode={mode} />
      <AuthPanel mode={mode} onModeChange={switchMode} onAuthenticated={onAuthenticated} />
    </div>
  );
}
