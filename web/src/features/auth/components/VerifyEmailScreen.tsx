'use client';

import { useQueryClient } from '@tanstack/react-query';
import { CircleAlert, Loader2, MailCheck } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { api, errorMessage, unwrap } from '@/shared/api';
import { ME_KEY, useSession } from '@/shared/session';
import { buttonClasses } from '@/shared/ui';

type State = { status: 'pending' } | { status: 'done' } | { status: 'error'; message: string };

/** /verify-email?token=… : lien reçu après l'inscription, confirme l'adresse du compte. */
export function VerifyEmailScreen() {
  const token = useSearchParams().get('token') ?? '';
  const { isAuthenticated } = useSession();
  const queryClient = useQueryClient();
  const [state, setState] = useState<State>(token ? { status: 'pending' } : { status: 'error', message: 'Lien incomplet.' });
  const sent = useRef(false);

  useEffect(() => {
    if (!token || sent.current) return;
    sent.current = true; // un seul envoi, même si l'effet est rejoué (mode strict)
    unwrap(api.POST('/api/accounts/email/verify/', { body: { token } }))
      .then(() => {
        setState({ status: 'done' });
        void queryClient.invalidateQueries({ queryKey: ME_KEY });
      })
      .catch((error) => setState({ status: 'error', message: errorMessage(error) }));
  }, [queryClient, token]);

  return (
    <div className="mx-auto w-full max-w-md rounded-3xl border border-line bg-card p-6 text-center shadow-2xl sm:p-8">
      <span className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-primary-soft text-primary-ink [&_svg]:size-6">
        {state.status === 'pending' ? (
          <Loader2 className="animate-spin" aria-hidden />
        ) : state.status === 'done' ? (
          <MailCheck aria-hidden />
        ) : (
          <CircleAlert aria-hidden />
        )}
      </span>
      <h1 className="mb-2 text-headline-xl text-ink">
        {state.status === 'pending' ? 'Vérification…' : state.status === 'done' ? 'Adresse confirmée' : 'Lien non valable'}
      </h1>
      <p className="mb-6 text-body-md text-ink-muted" role="status">
        {state.status === 'pending'
          ? 'Un instant, nous vérifions votre lien.'
          : state.status === 'done'
            ? 'Merci : votre adresse e-mail est vérifiée.'
            : `${state.message} Depuis Réglages > Compte, vous pouvez demander un nouvel e-mail.`}
      </p>
      {state.status !== 'pending' ? (
        <Link href={isAuthenticated ? (state.status === 'done' ? '/feed' : '/settings') : '/login'} className={buttonClasses()}>
          {isAuthenticated ? (state.status === 'done' ? 'Continuer' : 'Ouvrir les réglages') : 'Se connecter'}
        </Link>
      ) : null}
    </div>
  );
}
