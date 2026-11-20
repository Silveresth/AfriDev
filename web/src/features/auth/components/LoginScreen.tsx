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
    // /login et /register ont chacun leur mode par défaut : on change de chemin (et non
    // seulement de ?mode=), sinon « Se connecter » depuis /register ne fait rien.
    const params = new URLSearchParams(searchParams.toString());
    params.delete('mode');
    const path = next === 'register' ? '/register' : '/login';
    router.replace(params.size ? `${path}?${params}` : path);
  };

  const onAuthenticated = (response: AuthResponse) => {
    if (!completeAuth(response, signIn)) router.push('/verify-2fa');
  };

  return (
    <div className="relative flex max-h-[94dvh] min-h-[min(42rem,94dvh)] w-full animate-pop overflow-hidden rounded-[1.75rem] border border-line bg-card shadow-[0_40px_100px_-30px_rgba(10,10,11,0.35)]">
      <button
        type="button"
        onClick={close}
        aria-label="Fermer"
        className="absolute top-4 right-4 z-20 flex size-9 items-center justify-center rounded-full bg-container-low text-ink-muted transition-colors hover:bg-container hover:text-ink md:bg-white/10 md:text-white/80 md:backdrop-blur md:hover:bg-white/20 md:hover:text-white"
      >
        <X className="size-4" aria-hidden />
      </button>
      <AuthPanel mode={mode} onModeChange={switchMode} onAuthenticated={onAuthenticated} />
      <AuthShowcase mode={mode} />
    </div>
  );
}
