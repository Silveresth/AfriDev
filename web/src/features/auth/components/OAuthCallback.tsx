'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { errorMessage } from '@/shared/api';
import { useSession } from '@/shared/session';
import { buttonClasses, ErrorNotice, Spinner } from '@/shared/ui';

import { afterLogin, authApi, completeAuth, consumeOAuthState, oauthRedirectUri } from '../api';

/** Retour de GitHub / GitLab : échange du code contre une session AfriDev. */
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
      const code = params.get('code');
      const provider = consumeOAuthState(params.get('state'));
      if (params.get('error')) {
        setError('Connexion annulée chez le fournisseur.');
        return;
      }
      if (!code || !provider) {
        setError('Lien de connexion invalide ou expiré. Recommencez depuis la page de connexion.');
        return;
      }
      try {
        const response = await authApi.oauth(provider, code, oauthRedirectUri());
        if (!completeAuth(response, signIn)) {
          router.replace('/verify-2fa');
          return;
        }
        router.replace(response.created ? '/profile?welcome=1' : afterLogin.take());
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
    <p className="flex items-center gap-3 text-body-lg text-ink-muted" role="status">
      <Spinner /> Connexion en cours…
    </p>
  );
}
