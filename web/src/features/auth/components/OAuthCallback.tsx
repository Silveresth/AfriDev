'use client';

import { CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { errorMessage } from '@/shared/api';
import { useSession } from '@/shared/session';
import { buttonClasses, ErrorNotice, LogoMark, Spinner } from '@/shared/ui';

import { afterLogin, authApi, completeAuth, consumeOAuthReturn } from '../api';

const CONNECTING_MS = 900;
const WELCOME_MS = 1000;
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Retour de Google / GitHub (via le rebond de l'API) : échange du code contre une session,
 * avec une courte transition (logo animé, puis « bienvenue ») avant la redirection. */
export function OAuthCallback() {
  const params = useSearchParams();
  const router = useRouter();
  const { signIn } = useSession();
  const [error, setError] = useState<string | null>(null);
  const [welcome, setWelcome] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return; // le code OAuth n'est valable qu'une fois
    started.current = true;
    void (async () => {
      if (params.get('error')) {
        setError(params.get('error') === 'access_denied' ? 'Connexion annulée chez le fournisseur.' : `Connexion refusée : ${params.get('error')}`);
        return;
      }
      const ticket = consumeOAuthReturn(params);
      if (!ticket) {
        setError('Lien de connexion invalide ou expiré. Recommencez depuis la page de connexion.');
        return;
      }
      try {
        const startedAt = Date.now();
        const response = await authApi.oauth(ticket.provider, ticket.code, ticket.redirectUri);
        await wait(Math.max(0, CONNECTING_MS - (Date.now() - startedAt)));
        if (!completeAuth(response, signIn)) {
          router.replace('/verify-2fa');
          return;
        }
        setWelcome(true);
        await wait(WELCOME_MS);
        // Nouveau compte : l'assistant d'accueil s'ouvre de lui-même (needs_onboarding).
        router.replace(afterLogin.take());
      } catch (e) {
        setError(errorMessage(e));
      }
    })();
  }, [params, router, signIn]);

  if (error) {
    return (
      <ErrorNotice
        title="Connexion impossible"
        message={error}
        action={
          <Link href="/login" className={buttonClasses({ size: 'sm', className: 'mt-2' })}>
            Retour à la connexion
          </Link>
        }
      />
    );
  }
  return (
    <div className="flex flex-col items-center gap-5 py-6 text-center" role="status" aria-live="polite">
      {welcome ? (
        <>
          <span className="animate-pop flex size-20 items-center justify-center rounded-full bg-secondary/20 ring-8 ring-secondary/10">
            <CheckCircle2 className="size-11 text-secondary" aria-hidden />
          </span>
          <p className="animate-pop text-headline-md text-white">Connecté, bienvenue !</p>
        </>
      ) : (
        <>
          <span className="relative flex size-20 items-center justify-center">
            <span className="absolute inset-0 animate-ping rounded-full bg-primary/25" aria-hidden />
            <LogoMark size={56} className="relative animate-pulse" />
          </span>
          <p className="flex items-center gap-2 text-body-lg text-white/80">
            <Spinner /> Connexion en cours…
          </p>
        </>
      )}
    </div>
  );
}
