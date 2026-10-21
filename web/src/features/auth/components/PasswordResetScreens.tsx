'use client';

import { ArrowLeft, KeyRound, MailCheck } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

import { errorMessage } from '@/shared/api';
import { useSession } from '@/shared/session';
import { Button, Field, FormError, Input } from '@/shared/ui';

import { authApi, completeAuth } from '../api';

function Frame({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-md overflow-hidden rounded-3xl border border-line bg-card p-6 shadow-2xl sm:p-8">
      <Link href="/login" className="mb-6 inline-flex items-center gap-1.5 text-body-sm text-ink-muted hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden /> Retour à la connexion
      </Link>
      <span className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-primary-soft text-primary-ink [&_svg]:size-6">{icon}</span>
      <h1 className="mb-2 text-headline-xl text-ink">{title}</h1>
      {children}
    </div>
  );
}

/**
 * /forgot-password, en deux étapes :
 * 1. l'e-mail → l'API envoie un code à 6 chiffres (15 min) et un lien (1 h), réponse identique
 *    que l'adresse existe ou non ;
 * 2. le code + le nouveau mot de passe → connexion directe (le lien de l'e-mail reste valable).
 */
export function ForgotPasswordScreen() {
  const router = useRouter();
  const { signIn } = useSession();
  const [email, setEmail] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const cleanEmail = email.trim();

  const requestCode = async (resend = false) => {
    setError(null);
    setNotice(null);
    setLoading(true);
    try {
      await authApi.requestPasswordReset(cleanEmail);
      setStep('code');
      if (resend) setNotice('Un nouveau code vient d’être envoyé.');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  if (step === 'code') {
    return (
      <Frame icon={<MailCheck aria-hidden />} title="Saisissez le code reçu">
        <p className="mb-6 text-body-md text-ink-muted">
          Si un compte correspond à <strong className="text-ink">{cleanEmail}</strong>, un code à 6 chiffres vient d&apos;être envoyé (valable 15
          minutes). Pensez à regarder dans les indésirables.
        </p>
        <form
          className="space-y-4"
          onSubmit={async (event) => {
            event.preventDefault();
            setError(null);
            if (password !== confirm) {
              setError('Les deux mots de passe ne correspondent pas.');
              return;
            }
            setLoading(true);
            try {
              const response = await authApi.resetPasswordWithCode(cleanEmail, code, password);
              router.replace(completeAuth(response, signIn) ? '/' : '/verify-2fa');
            } catch (err) {
              setError(errorMessage(err));
              setLoading(false);
            }
          }}
        >
          <Field label="Code à 6 chiffres" htmlFor="reset-code">
            <Input
              id="reset-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              maxLength={6}
              required
              autoFocus
              placeholder="123456"
              className="text-center font-mono text-headline-md tracking-[0.5em]"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            />
          </Field>
          <Field label="Nouveau mot de passe" htmlFor="code-new-password" hint="8 caractères minimum, dont un chiffre.">
            <Input id="code-new-password" type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          <Field label="Confirmer" htmlFor="code-confirm-password">
            <Input id="code-confirm-password" type="password" required minLength={8} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </Field>
          {notice ? <p className="text-body-sm text-success">{notice}</p> : null}
          {error ? <FormError>{error}</FormError> : null}
          <Button type="submit" className="w-full" loading={loading} disabled={code.length !== 6 || password.length < 8}>
            Changer le mot de passe et me connecter
          </Button>
        </form>
        <div className="mt-5 flex items-center justify-between text-body-sm">
          <button type="button" className="font-semibold text-primary-ink hover:underline disabled:opacity-50" disabled={loading} onClick={() => void requestCode(true)}>
            Renvoyer un code
          </button>
          <button
            type="button"
            className="text-ink-muted hover:text-ink"
            onClick={() => {
              setStep('email');
              setCode('');
              setError(null);
              setNotice(null);
            }}
          >
            Changer d&apos;adresse
          </button>
        </div>
      </Frame>
    );
  }
  return (
    <Frame icon={<KeyRound aria-hidden />} title="Mot de passe oublié">
      <p className="mb-6 text-body-md text-ink-muted">Indiquez l&apos;e-mail de votre compte : nous vous envoyons un code à 6 chiffres pour en choisir un nouveau.</p>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void requestCode();
        }}
      >
        <Field label="E-mail" htmlFor="reset-email">
          <Input id="reset-email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        {error ? <FormError>{error}</FormError> : null}
        <Button type="submit" className="w-full" loading={loading}>
          Recevoir le code
        </Button>
      </form>
      <p className="mt-5 text-body-sm text-ink-muted">
        Inscrit·e avec Google ou GitHub ? <Link href="/login" className="font-semibold text-primary-ink hover:underline">Reconnectez-vous de la même façon.</Link>
      </p>
    </Frame>
  );
}

/** /reset-password?uid=…&token=… : nouveau mot de passe, puis connexion directe. */
export function ResetPasswordScreen() {
  const params = useSearchParams();
  const router = useRouter();
  const { signIn } = useSession();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const uid = params.get('uid') ?? '';
  const token = params.get('token') ?? '';

  return (
    <Frame icon={<KeyRound aria-hidden />} title="Nouveau mot de passe">
      <p className="mb-6 text-body-md text-ink-muted">Les autres appareils connectés seront déconnectés par sécurité.</p>
      <form
        className="space-y-4"
        onSubmit={async (event) => {
          event.preventDefault();
          setError(null);
          if (password !== confirm) {
            setError('Les deux mots de passe ne correspondent pas.');
            return;
          }
          setLoading(true);
          try {
            const response = await authApi.confirmPasswordReset(uid, token, password);
            router.replace(completeAuth(response, signIn) ? '/' : '/verify-2fa');
          } catch (err) {
            setError(errorMessage(err));
            setLoading(false);
          }
        }}
      >
        <Field label="Nouveau mot de passe" htmlFor="new-password" hint="8 caractères minimum, dont un chiffre.">
          <Input id="new-password" type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Field label="Confirmer" htmlFor="confirm-password">
          <Input id="confirm-password" type="password" required minLength={8} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </Field>
        {!uid || !token ? <FormError>Lien incomplet : ouvrez le lien reçu par e-mail.</FormError> : null}
        {error ? <FormError>{error}</FormError> : null}
        <Button type="submit" className="w-full" loading={loading} disabled={!uid || !token}>
          Enregistrer et me connecter
        </Button>
      </form>
    </Frame>
  );
}
