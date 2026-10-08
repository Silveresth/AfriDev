'use client';

import { AlertCircle, ArrowLeft, ArrowRight, KeyRound, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { errorMessage } from '@/shared/api';
import { useIsClient } from '@/shared/hooks';
import { useSession } from '@/shared/session';
import { Button } from '@/shared/ui';

import { afterLogin, authApi, pendingMfa } from '../api';

export function VerifyTwoFactorScreen() {
  const router = useRouter();
  const { signIn } = useSession();
  const isClient = useIsClient();
  const challenge = isClient ? pendingMfa.get() : null;
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isClient && !challenge) router.replace('/login');
  }, [isClient, challenge, router]);

  async function verify(value: string) {
    if (!challenge || value.length !== 6) return;
    setError(null);
    setLoading(true);
    try {
      const response = await authApi.loginMfa(challenge.token, value);
      if (!response.tokens) throw new Error('Connexion incomplète, recommencez.');
      pendingMfa.clear();
      signIn(response.tokens);
      router.replace(challenge.created ? '/profile?welcome=1' : afterLogin.take());
    } catch (e) {
      setError(errorMessage(e));
      setCode('');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full">
      <div className="overflow-hidden rounded-2xl border border-line bg-card shadow-elev-raised">
        <div className="border-b border-line bg-container-low/60 p-6 pb-5">
          <Link
            href="/login"
            className="mb-4 inline-flex items-center gap-1 text-xs font-semibold text-ink-muted hover:text-ink transition-colors"
          >
            <ArrowLeft className="size-3.5" />
            <span>Retour à la connexion</span>
          </Link>

          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-xl bg-primary-soft text-primary-ink">
              <KeyRound className="size-6" />
            </span>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-ink">Double Authentification (2FA)</h2>
              <p className="text-xs text-ink-muted">Application Authenticator (Aegis, 2FAS, Google Authenticator…)</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {error && (
            <div
              role="alert"
              className="flex items-start gap-3 rounded-xl border border-danger/30 bg-danger-soft p-3.5 text-xs text-on-danger-soft animate-in fade-in"
            >
              <AlertCircle className="size-4.5 shrink-0 text-danger mt-0.5" />
              <div className="font-medium">{error}</div>
            </div>
          )}

          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void verify(code);
            }}
          >
            <div className="space-y-1.5">
              <label htmlFor="totp" className="block text-xs font-bold text-ink text-center">
                Saisissez le code à 6 chiffres
              </label>
              <input
                id="totp"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                autoFocus
                placeholder="123 456"
                value={code}
                disabled={loading}
                onChange={(event) => {
                  const next = event.target.value.replace(/\D/g, '').slice(0, 6);
                  setCode(next);
                  if (next.length === 6) void verify(next);
                }}
                className="h-14 w-full text-center font-mono text-2xl font-bold tracking-[0.35em] rounded-xl border border-line-strong bg-card text-ink shadow-xs transition-all hover:border-ink-faint/60 focus:border-primary focus:ring-4 focus:ring-primary/12 focus:outline-none"
              />
              <p className="text-center text-[0.75rem] text-ink-faint">
                Le code change toutes les 30 secondes.
              </p>
            </div>

            <Button
              type="submit"
              size="lg"
              className="w-full h-11 text-sm font-bold shadow-md"
              loading={loading}
              disabled={code.length !== 6}
            >
              <span>Vérifier et continuer</span>
              <ArrowRight className="size-4.5 ml-1" />
            </Button>
          </form>
        </div>

        <div className="border-t border-line bg-container-low/40 px-6 py-3 text-center text-xs text-ink-faint flex items-center justify-center gap-1.5">
          <ShieldCheck className="size-3.5 text-secondary" />
          <span>Protection de compte renforcée</span>
        </div>
      </div>
    </div>
  );
}
