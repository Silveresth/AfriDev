'use client';

import {
  AlertCircle,
  ArrowRight,
  AtSign,
  Check,
  Eye,
  EyeOff,
  Lock,
  Mail,
  Sparkles,
  User,
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { errorMessage } from '@/shared/api';
import { useLang } from '@/shared/i18n';
import { cn } from '@/shared/lib';
import { useSession } from '@/shared/session';
import { Button, Spinner } from '@/shared/ui';

import {
  afterLogin,
  authApi,
  type AuthResponse,
  completeAuth,
  type OAuthProvider,
  oauthAvailable,
  startOAuth,
} from '../api';

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn('size-4.5 shrink-0', className)} fill="currentColor" aria-hidden>
      <path d="M12 .5a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2c-3.3.7-4-1.6-4-1.6-.6-1.4-1.4-1.8-1.4-1.8-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.7-1.6-2.7-.3-5.5-1.3-5.5-6 0-1.2.5-2.3 1.3-3.1-.2-.4-.6-1.6 0-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0C17.3 4.7 18.3 5 18.3 5c.7 1.6.2 2.8.1 3.2.8.8 1.3 1.9 1.3 3.1 0 4.7-2.8 5.7-5.5 6 .4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 .5Z" />
    </svg>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn('size-4.5 shrink-0', className)} aria-hidden>
      <path
        fill="#4285F4"
        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.26v3.15C3.25 21.36 7.33 24 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.26C.46 8.16 0 9.97 0 12s.46 3.84 1.26 5.42l4.02-3.15Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.25 2.64 1.26 6.58l4.02 3.15c.95-2.83 3.6-4.93 6.72-4.93Z"
      />
    </svg>
  );
}

function ProviderButton({ provider }: { provider: OAuthProvider }) {
  const available = oauthAvailable(provider);
  const label = provider === 'github' ? 'GitHub' : provider === 'google' ? 'Google' : 'GitLab';
  const [starting, setStarting] = useState(false);

  const handleClick = () => {
    if (!available) {
      alert(`La connexion avec ${label} sera active dès la configuration de votre CLIENT_ID sur le serveur.`);
      return;
    }
    setStarting(true);
    startOAuth(provider);
  };

  return (
    <button
      type="button"
      disabled={starting}
      onClick={handleClick}
      className={cn(
        'relative flex h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-line-strong bg-card px-3 text-xs font-semibold text-ink shadow-xs transition-all duration-150 select-none hover:bg-container hover:border-ink/40 cursor-pointer disabled:opacity-50',
      )}
    >
      {starting ? (
        <Spinner className="size-4" />
      ) : provider === 'github' ? (
        <GitHubIcon />
      ) : provider === 'google' ? (
        <GoogleIcon />
      ) : null}
      <span>{label}</span>
    </button>
  );
}

type AuthMode = 'login' | 'register';

interface LoginScreenProps {
  initialMode?: AuthMode;
}

export function LoginScreen({ initialMode = 'login' }: LoginScreenProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signIn, isAuthenticated } = useSession();
  const { t } = useLang();

  const modeParam = searchParams.get('mode');
  const mode: AuthMode = modeParam === 'register' ? 'register' : modeParam === 'login' ? 'login' : initialMode;

  useEffect(() => {
    afterLogin.set(new URLSearchParams(window.location.search).get('next'));
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      router.replace(afterLogin.take());
    }
  }, [isAuthenticated, router]);

  const handleModeSwitch = (newMode: AuthMode) => {
    const params = new URLSearchParams(searchParams.toString());
    if (newMode === 'register') {
      params.set('mode', 'register');
    } else {
      params.delete('mode');
    }
    const qs = params.toString();
    router.replace(qs ? `?${qs}` : window.location.pathname);
  };

  return (
    <div className="w-full">
      {/* ── Carte principale du formulaire ── */}
      <div className="overflow-hidden rounded-2xl border border-line bg-card shadow-elev-raised transition-all">
        {/* En-tête de la carte */}
        <div className="border-b border-line bg-container-low/50 p-6 pb-5">
          <h2 className="text-xl font-bold tracking-tight text-ink">
            {mode === 'login' ? t('auth.card_login_title') : t('auth.card_register_title')}
          </h2>
          <p className="mt-1 text-xs text-ink-muted leading-relaxed">
            {mode === 'login' ? t('auth.card_login_desc') : t('auth.card_register_desc')}
          </p>

          {/* Onglets interactifs Login / Register */}
          <div className="mt-4 grid grid-cols-2 gap-1 rounded-xl bg-container p-1 border border-line">
            <button
              type="button"
              onClick={() => handleModeSwitch('login')}
              className={cn(
                'flex h-8.5 items-center justify-center rounded-lg text-xs font-semibold transition-all select-none cursor-pointer',
                mode === 'login'
                  ? 'bg-card text-ink shadow-xs'
                  : 'text-ink-muted hover:text-ink hover:bg-container-high/40',
              )}
            >
              {t('auth.login')}
            </button>
            <button
              type="button"
              onClick={() => handleModeSwitch('register')}
              className={cn(
                'flex h-8.5 items-center justify-center rounded-lg text-xs font-semibold transition-all select-none cursor-pointer',
                mode === 'register'
                  ? 'bg-card text-ink shadow-xs'
                  : 'text-ink-muted hover:text-ink hover:bg-container-high/40',
              )}
            >
              {t('auth.register')}
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {/* Boutons OAuth Google & GitHub */}
          <div className="space-y-3">
            <div className="flex gap-2.5">
              <ProviderButton provider="google" />
              <ProviderButton provider="github" />
            </div>

            {/* Séparateur élégant */}
            <div className="relative flex items-center justify-center pt-1">
              <div className="w-full border-t border-line" />
              <span className="absolute bg-card px-2.5 text-[0.7rem] font-medium uppercase tracking-wider text-ink-faint">
                {t('auth.or_email')}
              </span>
            </div>
          </div>

          {/* Formulaire Email / Nom d'utilisateur */}
          <CredentialsForm
            mode={mode}
            onSuccess={(response) => {
              const ok = completeAuth(response, signIn);
              if (!ok) router.push('/verify-2fa');
            }}
          />
        </div>

        {/* Pied de carte */}
        <div className="border-t border-line bg-container-low/40 px-6 py-3 text-center text-[0.72rem] text-ink-faint">
          <Lock className="inline size-3 mr-1 text-ink-muted -translate-y-px" />
          {t('auth.secured_badge')}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Formulaire Email / Nom d'utilisateur + Mot de passe
 * ───────────────────────────────────────────────────────────── */
function CredentialsForm({
  mode,
  onSuccess,
}: {
  mode: AuthMode;
  onSuccess: (response: AuthResponse) => void;
}) {
  const { t } = useLang();
  const [form, setForm] = useState({ identifier: '', username: '', email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const updateField = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [field]: e.target.value });
    if (error) setError(null);
  };

  // Analyse de robustesse du mot de passe
  const passwordStats = useMemo(() => {
    const pwd = form.password;
    const hasMinLen = pwd.length >= 8;
    const hasNumber = /\d/.test(pwd);
    const hasSpecialOrUpper = /[A-Z!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pwd);

    let score = 0;
    if (pwd.length > 0) score += 1;
    if (hasMinLen) score += 1;
    if (hasNumber) score += 1;
    if (hasSpecialOrUpper) score += 1;

    return { score, hasMinLen, hasNumber, hasSpecialOrUpper };
  }, [form.password]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === 'login') {
        const response = await authApi.login(form.identifier, form.password);
        onSuccess(response);
      } else {
        if (!form.username || form.username.length < 3) {
          throw new Error("Le nom d'utilisateur doit contenir au moins 3 caractères.");
        }
        if (form.password.length < 8) {
          throw new Error('Le mot de passe doit contenir au moins 8 caractères.');
        }
        const response = await authApi.register({
          username: form.username.trim(),
          email: form.email.trim(),
          password: form.password,
        });
        onSuccess(response);
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3.5">
      {/* Alerte d'erreur */}
      {error && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-xl border border-danger/30 bg-danger-soft p-3 text-xs text-on-danger-soft animate-in fade-in"
        >
          <AlertCircle className="size-4 shrink-0 text-danger mt-0.5" />
          <div className="font-medium">{error}</div>
        </div>
      )}

      {mode === 'login' ? (
        /* Champ identifiant de connexion (Email ou Nom d'utilisateur) */
        <div className="space-y-1.5">
          <label htmlFor="identifier" className="block text-xs font-semibold text-ink">
            {t('auth.email_or_username')}
          </label>
          <div className="relative">
            <User className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-ink-faint" />
            <input
              id="identifier"
              type="text"
              required
              autoComplete="username"
              placeholder={t('auth.identifier_placeholder')}
              value={form.identifier}
              onChange={updateField('identifier')}
              className="h-10.5 w-full rounded-xl border border-line-strong bg-card pl-9.5 pr-3.5 text-xs text-ink placeholder:text-ink-faint transition-all hover:border-ink-faint/60 focus:border-primary focus:ring-4 focus:ring-primary/12 focus:outline-none"
            />
          </div>
        </div>
      ) : (
        /* Champs d'inscription (Nom d'utilisateur + Email) */
        <>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="reg-username" className="block text-xs font-semibold text-ink">
                {t('auth.username')}
              </label>
              <span className="text-[0.68rem] text-ink-faint">{t('auth.username_hint')}</span>
            </div>
            <div className="relative">
              <AtSign className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-ink-faint" />
              <input
                id="reg-username"
                type="text"
                required
                autoComplete="username"
                pattern="[A-Za-z0-9_]{3,30}"
                placeholder={t('auth.username_placeholder')}
                value={form.username}
                onChange={updateField('username')}
                className="h-10.5 w-full rounded-xl border border-line-strong bg-card pl-9.5 pr-3.5 text-xs text-ink placeholder:text-ink-faint transition-all hover:border-ink-faint/60 focus:border-primary focus:ring-4 focus:ring-primary/12 focus:outline-none"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="reg-email" className="block text-xs font-semibold text-ink">
              {t('auth.email')}
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-ink-faint" />
              <input
                id="reg-email"
                type="email"
                required
                autoComplete="email"
                placeholder={t('auth.email_placeholder')}
                value={form.email}
                onChange={updateField('email')}
                className="h-10.5 w-full rounded-xl border border-line-strong bg-card pl-9.5 pr-3.5 text-xs text-ink placeholder:text-ink-faint transition-all hover:border-ink-faint/60 focus:border-primary focus:ring-4 focus:ring-primary/12 focus:outline-none"
              />
            </div>
          </div>
        </>
      )}

      {/* Champ Mot de passe avec toggle visibilité */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label htmlFor="password" className="block text-xs font-semibold text-ink">
            {t('auth.password')}
          </label>
          {mode === 'register' && (
            <span className="text-[0.68rem] text-ink-faint">
              {t('auth.password_min')}
            </span>
          )}
        </div>
        <div className="relative">
          <Lock className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-ink-faint" />
          <input
            id="password"
            type={showPassword ? 'text' : 'password'}
            required
            minLength={mode === 'register' ? 8 : undefined}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            placeholder="••••••••"
            value={form.password}
            onChange={updateField('password')}
            className="h-10.5 w-full rounded-xl border border-line-strong bg-card pl-9.5 pr-10 text-xs text-ink placeholder:text-ink-faint transition-all hover:border-ink-faint/60 focus:border-primary focus:ring-4 focus:ring-primary/12 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            tabIndex={-1}
            aria-label={showPassword ? t('auth.password_hide') : t('auth.password_show')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-ink-faint hover:text-ink rounded-lg transition-colors cursor-pointer"
          >
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>

        {/* Indicateur de force du mot de passe lors de l'inscription */}
        {mode === 'register' && form.password.length > 0 && (
          <div className="space-y-1.5 pt-1 animate-in fade-in duration-150">
            <div className="flex h-1.5 w-full gap-1 overflow-hidden rounded-full bg-container">
              <div
                className={cn(
                  'h-full flex-1 rounded-full transition-all duration-300',
                  passwordStats.score >= 1
                    ? passwordStats.score <= 2
                      ? 'bg-danger'
                      : passwordStats.score === 3
                        ? 'bg-tertiary'
                        : 'bg-secondary'
                    : 'bg-transparent',
                )}
              />
              <div
                className={cn(
                  'h-full flex-1 rounded-full transition-all duration-300',
                  passwordStats.score >= 3
                    ? passwordStats.score === 3
                      ? 'bg-tertiary'
                      : 'bg-secondary'
                    : 'bg-transparent',
                )}
              />
              <div
                className={cn(
                  'h-full flex-1 rounded-full transition-all duration-300',
                  passwordStats.score >= 4 ? 'bg-secondary' : 'bg-transparent',
                )}
              />
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[0.68rem] text-ink-muted">
              <span className={cn('flex items-center gap-1', passwordStats.hasMinLen ? 'text-secondary font-semibold' : 'text-ink-faint')}>
                <Check className="size-3" /> {t('auth.password_criteria_len')}
              </span>
              <span className={cn('flex items-center gap-1', passwordStats.hasNumber ? 'text-secondary font-semibold' : 'text-ink-faint')}>
                <Check className="size-3" /> {t('auth.password_criteria_num')}
              </span>
              <span className={cn('flex items-center gap-1', passwordStats.hasSpecialOrUpper ? 'text-secondary font-semibold' : 'text-ink-faint')}>
                <Check className="size-3" /> {t('auth.password_criteria_special')}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Bouton de soumission principal */}
      <Button
        type="submit"
        size="lg"
        loading={loading}
        className="w-full h-10.5 text-xs font-bold shadow-xs transition-all active:scale-[0.99] mt-3"
      >
        {mode === 'login' ? (
          <>
            <span>{t('auth.login')}</span>
            <ArrowRight className="size-4 ml-1" />
          </>
        ) : (
          <>
            <Sparkles className="size-3.5 mr-1 text-yellow-300" />
            <span>{t('auth.create_account_free')}</span>
          </>
        )}
      </Button>
    </form>
  );
}
