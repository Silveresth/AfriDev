'use client';

import { joinPhone } from '@afridev/validation';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, AtSign, Check, Eye, EyeOff, Loader2, Mail, Smartphone, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useState } from 'react';

import { errorMessage } from '@/shared/api';
import { cn } from '@/shared/lib';
import { Spinner } from '@/shared/ui';

import { authApi, type AuthResponse, COUNTRIES, type OAuthProvider, pendingPhone, startOAuth, useOAuthProviders } from '../api';
import { GitHubIcon, GitLabIcon, GoogleIcon } from './ProviderIcons';

export type AuthMode = 'login' | 'register';
type Method = 'email' | 'phone';

const PROVIDERS: Record<OAuthProvider, { label: string; icon: typeof GoogleIcon }> = {
  google: { label: 'Google', icon: GoogleIcon },
  github: { label: 'GitHub', icon: GitHubIcon },
  gitlab: { label: 'GitLab', icon: GitLabIcon },
};

const FIELD =
  'h-11 w-full rounded-xl border border-line-strong bg-card px-3.5 text-body-sm text-ink placeholder:text-ink-faint transition-colors hover:border-ink/30 focus:border-primary focus:ring-4 focus:ring-primary/15 focus:outline-none aria-[invalid=true]:border-danger';

/**
 * Formulaire de connexion / inscription partagé par la page /login et la fenêtre modale :
 * Google · GitHub (seulement s'ils sont configurés), e-mail + mot de passe, ou numéro de
 * téléphone (code SMS, pratique sans adresse e-mail).
 */
export function AuthPanel({
  mode,
  onModeChange,
  onAuthenticated,
}: {
  mode: AuthMode;
  onModeChange: (mode: AuthMode) => void;
  onAuthenticated: (response: AuthResponse) => void;
}) {
  const [method, setMethod] = useState<Method>('email');
  return (
    <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-6 sm:p-8 md:p-10">
      <div role="tablist" aria-label="Connexion ou inscription" className="grid grid-cols-2 rounded-full bg-container p-1">
        {(['login', 'register'] as const).map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={mode === value}
            onClick={() => onModeChange(value)}
            className={cn(
              'h-9 rounded-full text-body-sm font-semibold transition-all',
              mode === value ? 'bg-card text-ink shadow-[0_1px_2px_rgba(10,10,11,0.1)] ring-1 ring-line' : 'text-ink-muted hover:text-ink',
            )}
          >
            {value === 'login' ? 'Se connecter' : 'Créer un compte'}
          </button>
        ))}
      </div>

      <div className="space-y-1">
        <h1 className="text-headline-xl text-ink">{mode === 'login' ? 'Content de vous revoir' : 'Rejoindre AfriDev'}</h1>
        <p className="text-body-sm text-ink-muted">
          {mode === 'login' ? 'Reprenez là où vous vous étiez arrêté·e.' : 'Gratuit, sans publicité. Votre fil se règle juste après.'}
        </p>
      </div>

      <OAuthButtons />

      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Méthode">
        {(
          [
            ['email', 'E-mail', Mail],
            ['phone', 'Téléphone (SMS)', Smartphone],
          ] as const
        ).map(([value, label, Icon]) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={method === value}
            onClick={() => setMethod(value)}
            className={cn(
              'flex h-10 items-center justify-center gap-2 rounded-xl border text-body-sm font-medium transition-colors',
              method === value ? 'border-primary bg-primary-soft/50 text-ink' : 'border-line text-ink-muted hover:border-line-strong hover:text-ink',
            )}
          >
            <Icon className="size-4" aria-hidden /> {label}
          </button>
        ))}
      </div>

      {method === 'phone' ? <PhoneForm /> : <EmailForm mode={mode} onAuthenticated={onAuthenticated} />}

      <p className="mt-auto text-center text-label-md text-ink-faint">
        En continuant, vous acceptez les conditions d&apos;utilisation et la politique de confidentialité d&apos;AfriDev.
      </p>
    </div>
  );
}

function OAuthButtons() {
  const providers = useOAuthProviders();
  const [pending, setPending] = useState<OAuthProvider | null>(null);
  if (providers.isPending) {
    return <div className="h-11 animate-pulse rounded-full bg-container" aria-hidden />;
  }
  const available = (providers.data ?? []).filter((provider) => provider in PROVIDERS);
  if (!available.length) return null;
  return (
    <div className="space-y-4">
      <div className={cn('grid gap-2.5', available.length > 1 && 'sm:grid-cols-2')}>
        {available.map((provider) => {
          const { label, icon: Icon } = PROVIDERS[provider];
          return (
            <button
              key={provider}
              type="button"
              disabled={pending !== null}
              onClick={() => {
                setPending(provider);
                startOAuth(provider);
              }}
              className="flex h-11 items-center justify-center gap-2.5 rounded-full border border-line-strong bg-card px-4 text-body-sm font-semibold text-ink transition-all hover:-translate-y-px hover:border-ink/30 hover:shadow-sm disabled:opacity-60"
            >
              {pending === provider ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Icon />}
              Continuer avec {label}
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-3 text-label-md text-ink-faint">
        <span className="h-px flex-1 bg-line" />
        ou
        <span className="h-px flex-1 bg-line" />
      </div>
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div role="alert" className="flex items-start gap-2.5 rounded-xl border border-danger/30 bg-danger-soft p-3 text-body-sm text-on-danger-soft">
      <AlertCircle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />
      <span className="flex-1 font-medium">{message}</span>
    </div>
  );
}

function useDebounced<T>(value: T, delay = 400): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

/** Disponibilité du pseudo pendant la saisie (avec une suggestion s'il est pris). */
function UsernameField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const id = useId();
  const debounced = useDebounced(value.trim());
  const status = useQuery({
    queryKey: ['auth', 'username', debounced.toLowerCase()],
    queryFn: () => authApi.usernameStatus(debounced),
    enabled: debounced.length >= 3,
    staleTime: 30_000,
    meta: { persist: false },
  });
  const checked = debounced.length >= 3 && debounced === value.trim() ? status.data : undefined;
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-body-sm font-semibold text-ink">
        Nom d&apos;utilisateur
      </label>
      <div className="relative">
        <AtSign className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-faint" aria-hidden />
        <input
          id={id}
          required
          autoComplete="username"
          pattern="[A-Za-z0-9_]{3,30}"
          maxLength={30}
          placeholder="amadou_dev"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/\s/g, '_'))}
          aria-invalid={checked ? !checked.available : undefined}
          aria-describedby={`${id}-status`}
          className={cn(FIELD, 'pr-10 pl-9')}
        />
        <span className="absolute top-1/2 right-3.5 -translate-y-1/2" aria-hidden>
          {status.isFetching ? (
            <Loader2 className="size-4 animate-spin text-ink-faint" />
          ) : checked?.available ? (
            <Check className="size-4 text-secondary-ink" />
          ) : checked ? (
            <X className="size-4 text-danger" />
          ) : null}
        </span>
      </div>
      <p id={`${id}-status`} className="min-h-4 text-label-md" aria-live="polite">
        {checked?.available ? (
          <span className="text-secondary-ink">Disponible : votre profil sera /u/{value.trim()}</span>
        ) : checked ? (
          <span className="text-danger">
            {checked.reason}{' '}
            {checked.suggestion ? (
              <button type="button" onClick={() => onChange(checked.suggestion)} className="font-semibold underline underline-offset-2">
                Prendre « {checked.suggestion} »
              </button>
            ) : null}
          </span>
        ) : (
          <span className="text-ink-faint">3 à 30 caractères : lettres, chiffres, _</span>
        )}
      </p>
    </div>
  );
}

const RULES = [
  { label: '8 caractères', test: (p: string) => p.length >= 8 },
  { label: 'un chiffre', test: (p: string) => /\d/.test(p) },
  { label: 'une majuscule ou un symbole', test: (p: string) => /[A-Z]|[^A-Za-z0-9]/.test(p) },
];

function PasswordField({ mode, value, onChange }: { mode: AuthMode; value: string; onChange: (value: string) => void }) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const passed = RULES.filter((rule) => rule.test(value)).length;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="block text-body-sm font-semibold text-ink">
          Mot de passe
        </label>
        {mode === 'login' ? (
          <Link href="/forgot-password" className="text-label-md font-medium text-primary-ink hover:underline">
            Mot de passe oublié ?
          </Link>
        ) : null}
      </div>
      <div className="relative">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          required
          minLength={mode === 'register' ? 8 : undefined}
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          placeholder="••••••••"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn(FIELD, 'pr-11')}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
          className="absolute top-1/2 right-2 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-ink-muted hover:text-ink"
        >
          {visible ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
        </button>
      </div>
      {mode === 'register' && value ? (
        <div className="space-y-1.5 pt-0.5">
          <div className="grid grid-cols-3 gap-1" aria-hidden>
            {RULES.map((_, index) => (
              <span
                key={index}
                className={cn(
                  'h-1 rounded-full transition-colors',
                  index < passed ? (passed === 3 ? 'bg-secondary' : passed === 2 ? 'bg-tertiary' : 'bg-danger') : 'bg-container-high',
                )}
              />
            ))}
          </div>
          <ul className="flex flex-wrap gap-x-3 gap-y-0.5 text-label-md">
            {RULES.map((rule) => {
              const ok = rule.test(value);
              return (
                <li key={rule.label} className={cn('flex items-center gap-1', ok ? 'text-secondary-ink' : 'text-ink-faint')}>
                  {ok ? <Check className="size-3" aria-hidden /> : <span className="size-1 rounded-full bg-current" aria-hidden />}
                  {rule.label}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function EmailForm({ mode, onAuthenticated }: { mode: AuthMode; onAuthenticated: (response: AuthResponse) => void }) {
  const [form, setForm] = useState({ identifier: '', username: '', email: '', password: '' });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const set = (field: keyof typeof form) => (value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setError(null);
  };

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      onAuthenticated(
        mode === 'login'
          ? await authApi.login(form.identifier.trim(), form.password)
          : await authApi.register({ username: form.username.trim(), email: form.email.trim(), password: form.password }),
      );
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate={false}>
      {error ? <ErrorBox message={error} /> : null}
      {mode === 'login' ? (
        <div className="space-y-1.5">
          <label htmlFor="auth-identifier" className="block text-body-sm font-semibold text-ink">
            Nom d&apos;utilisateur ou e-mail
          </label>
          <input
            id="auth-identifier"
            required
            autoComplete="username"
            placeholder="amadou ou amadou@exemple.com"
            value={form.identifier}
            onChange={(e) => set('identifier')(e.target.value)}
            className={FIELD}
          />
        </div>
      ) : (
        <>
          <UsernameField value={form.username} onChange={set('username')} />
          <div className="space-y-1.5">
            <label htmlFor="auth-email" className="block text-body-sm font-semibold text-ink">
              E-mail
            </label>
            <input
              id="auth-email"
              type="email"
              required
              autoComplete="email"
              placeholder="amadou@exemple.com"
              value={form.email}
              onChange={(e) => set('email')(e.target.value)}
              className={FIELD}
            />
          </div>
        </>
      )}
      <PasswordField mode={mode} value={form.password} onChange={set('password')} />
      <button
        type="submit"
        disabled={loading}
        className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-primary px-4 text-body-sm font-bold text-on-primary shadow-sm transition-all hover:brightness-110 active:scale-[0.99] disabled:opacity-60"
      >
        {loading ? <Spinner className="size-4" /> : mode === 'login' ? 'Se connecter' : 'Créer mon compte'}
      </button>
    </form>
  );
}

/** Connexion ou inscription par SMS : le code arrive sur le téléphone (aucun e-mail requis). */
function PhoneForm() {
  const router = useRouter();
  const [country, setCountry] = useState<string>(COUNTRIES[0].code);
  const [number, setNumber] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { phone_number } = await authApi.requestOtp(joinPhone(country, number));
      pendingPhone.set(phone_number);
      router.push('/verify-otp');
    } catch (err) {
      setError(errorMessage(err));
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {error ? <ErrorBox message={error} /> : null}
      <div className="space-y-1.5">
        <label htmlFor="auth-phone" className="block text-body-sm font-semibold text-ink">
          Numéro de téléphone
        </label>
        <div className="flex gap-2">
          <select
            aria-label="Indicatif du pays"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className={cn(FIELD, 'w-32 shrink-0 px-2.5')}
          >
            {COUNTRIES.map((item) => (
              <option key={item.code + item.label} value={item.code}>
                {item.flag} {item.label} {item.code}
              </option>
            ))}
          </select>
          <input
            id="auth-phone"
            type="tel"
            inputMode="tel"
            required
            autoComplete="tel-national"
            placeholder="90 12 34 56"
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            className={FIELD}
          />
        </div>
        <p className="text-label-md text-ink-faint">Vous recevrez un code à 6 chiffres. Un compte est créé au premier passage.</p>
      </div>
      <button
        type="submit"
        disabled={loading || number.replace(/\D/g, '').length < 6}
        className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-primary px-4 text-body-sm font-bold text-on-primary shadow-sm transition-all hover:brightness-110 disabled:opacity-60"
      >
        {loading ? <Spinner className="size-4" /> : 'Recevoir le code par SMS'}
      </button>
    </form>
  );
}
