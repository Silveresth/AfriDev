'use client';

import { AlertCircle, ArrowLeft, ArrowRight, MessageSquareText, ShieldCheck, Smartphone } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { errorMessage } from '@/shared/api';
import { useIsClient } from '@/shared/hooks';
import { cn } from '@/shared/lib';
import { useSession } from '@/shared/session';
import { Button } from '@/shared/ui';

import { afterLogin, authApi, completeAuth, maskPhone, pendingPhone } from '../api';

const RESEND_AFTER = 45;
const LENGTH = 6;

interface OTPCredential extends Credential {
  code: string;
}

export function VerifyOtpScreen() {
  const router = useRouter();
  const { signIn } = useSession();
  const isClient = useIsClient();
  const phone = isClient ? pendingPhone.get() : null;
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [remaining, setRemaining] = useState(RESEND_AFTER);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isClient && !phone) router.replace('/login');
  }, [isClient, phone, router]);

  useEffect(() => {
    if (remaining <= 0) return;
    const timer = window.setTimeout(() => setRemaining((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [remaining]);

  function onCode(raw: string) {
    const next = raw.replace(/\D/g, '').slice(0, LENGTH);
    setCode(next);
    if (next.length === LENGTH) void verify(next);
  }

  async function verify(value: string) {
    if (!phone || value.length !== LENGTH) return;
    setError(null);
    setLoading(true);
    try {
      const response = await authApi.verifyOtp(phone, value);
      if (!completeAuth(response, signIn)) {
        router.replace('/verify-2fa');
        return;
      }
      router.replace(response.created ? '/profile?welcome=1' : afterLogin.take());
    } catch (e) {
      setError(errorMessage(e));
      setCode('');
      input.current?.focus();
    } finally {
      setLoading(false);
    }
  }

  // WebOTP API (Chrome Android)
  useEffect(() => {
    if (!phone || !('OTPCredential' in window)) return;
    const controller = new AbortController();
    navigator.credentials
      .get({ otp: { transport: ['sms'] }, signal: controller.signal } as CredentialRequestOptions)
      .then((credential) => {
        const otp = credential as OTPCredential | null;
        if (otp?.code) onCode(otp.code);
      })
      .catch(() => {});
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phone]);

  async function resend() {
    if (!phone) return;
    setError(null);
    try {
      await authApi.requestOtp(phone);
      setRemaining(RESEND_AFTER);
    } catch (e) {
      setError(errorMessage(e));
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
            <span>Changer de numéro</span>
          </Link>

          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-xl bg-secondary-soft text-on-secondary-soft">
              <Smartphone className="size-6" />
            </span>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-ink">Code de vérification SMS</h2>
              <p className="text-xs text-ink-muted">
                Envoyé au <span className="font-bold text-ink tabular-nums">{phone ? maskPhone(phone) : '…'}</span>
              </p>
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

          <div className="space-y-2">
            <label htmlFor="otp" className="sr-only">
              Code à 6 chiffres reçu par SMS
            </label>
            <div className="relative cursor-text" onClick={() => input.current?.focus()}>
              <input
                ref={input}
                id="otp"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="\d{6}"
                maxLength={LENGTH}
                value={code}
                disabled={loading}
                autoFocus
                onChange={(event) => onCode(event.target.value)}
                className="absolute inset-0 opacity-0 z-10 cursor-text"
                aria-describedby="otp-help"
              />
              <div className="grid grid-cols-6 gap-2" aria-hidden>
                {Array.from({ length: LENGTH }, (_, i) => (
                  <span
                    key={i}
                    className={cn(
                      'flex h-13 sm:h-15 items-center justify-center rounded-xl border-2 bg-card text-xl sm:text-2xl font-bold text-ink tabular-nums transition-all shadow-xs',
                      i === code.length
                        ? 'border-primary ring-4 ring-primary/15 scale-105'
                        : code[i]
                          ? 'border-line-strong bg-container-low/40'
                          : 'border-line',
                    )}
                  >
                    {code[i] ?? ''}
                  </span>
                ))}
              </div>
            </div>
            <p id="otp-help" className="text-center text-[0.75rem] text-ink-faint">
              Validation automatique dès que le 6ᵉ chiffre est renseigné.
            </p>
          </div>

          <Button
            size="lg"
            className="w-full h-11 text-sm font-bold shadow-md"
            loading={loading}
            disabled={code.length !== LENGTH}
            onClick={() => verify(code)}
          >
            <span>Valider le code</span>
            <ArrowRight className="size-4.5 ml-1" />
          </Button>

          <div className="flex items-center justify-center text-xs text-ink-muted pt-2 border-t border-line">
            {remaining > 0 ? (
              <span className="text-ink-faint">
                Renvoyer le SMS dans <span className="font-bold text-ink tabular-nums">0:{String(remaining).padStart(2, '0')}</span>
              </span>
            ) : (
              <button
                type="button"
                onClick={resend}
                className="inline-flex items-center gap-1.5 font-bold text-primary-ink hover:underline"
              >
                <MessageSquareText className="size-3.5" />
                <span>Renvoyer un nouveau code</span>
              </button>
            )}
          </div>
        </div>

        <div className="border-t border-line bg-container-low/40 px-6 py-3 text-center text-xs text-ink-faint flex items-center justify-center gap-1.5">
          <ShieldCheck className="size-3.5 text-secondary" />
          <span>Vérification sécurisée AfriDev</span>
        </div>
      </div>
    </div>
  );
}