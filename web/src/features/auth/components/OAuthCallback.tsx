'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { errorMessage } from '@/shared/api';
import { useSession } from '@/shared/session';
import { buttonClasses, ErrorNotice, Spinner } from '@/shared/ui';

import { afterLogin, authApi, completeAuth, consumeOAuthReturn } from '../api';

/** Retour de Google / GitHub (via le rebond de l'API) : échange du code contre une session. */
export function OAuthCallback() {
  const params = useSearchParams();
  const router = useRouter();
  const { signIn } = useSession();
  const [error, setError] = useState<string | null>(null);
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
        const response = await authApi.oauth(ticket.provider, ticket.code, ticket.redirectUri);
        if (!completeAuth(response, signIn)) {
          router.replace('/verify-2fa');
          return;
        }
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
    <p className="flex items-center gap-3 text-body-lg text-white/80" role="status">
      <Spinner /> Connexion en cours…
    </p>
  );
}
