'use client';

import {
  AlertCircle,
  Eye,
  EyeOff,
  Layers,
  MessagesSquare,
  Terminal,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { errorMessage } from '@/shared/api';
import { cn } from '@/shared/lib';
import { useSession } from '@/shared/session';
import { LogoMark, Spinner } from '@/shared/ui';

import {
  authApi,
  type AuthResponse,
  completeAuth,
  startOAuth,
} from '../api';
import { OnboardingPreferencesModal } from './OnboardingPreferencesModal';

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn('size-4 shrink-0', className)} fill="currentColor" aria-hidden>
      <path d="M12 .5a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2c-3.3.7-4-1.6-4-1.6-.6-1.4-1.4-1.8-1.4-1.8-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.7-1.6-2.7-.3-5.5-1.3-5.5-6 0-1.2.5-2.3 1.3-3.1-.2-.4-.6-1.6 0-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0C17.3 4.7 18.3 5 18.3 5c.7 1.6.2 2.8.1 3.2.8.8 1.3 1.9 1.3 3.1 0 4.7-2.8 5.7-5.5 6 .4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 .5Z" />
    </svg>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn('size-4 shrink-0', className)} aria-hidden>
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

export type AuthModalMode = 'login' | 'register';

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
  initialMode?: AuthModalMode;
}

export function AuthModal({ open, onClose, initialMode = 'login' }: AuthModalProps) {
  const router = useRouter();
  const { signIn, isAuthenticated } = useSession();

  const [mode, setMode] = useState<AuthModalMode>(initialMode);
  const [prevInitialMode, setPrevInitialMode] = useState<AuthModalMode>(initialMode);
  const [showOnboarding, setShowOnboarding] = useState(false);

  if (initialMode !== prevInitialMode) {
    setPrevInitialMode(initialMode);
    setMode(initialMode);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (isAuthenticated && !showOnboarding && open) {
      onClose();
    }
  }, [isAuthenticated, showOnboarding, open, onClose]);

  if (!open) return null;

  const handleAuthSuccess = (response: AuthResponse, wasRegister: boolean) => {
    const ok = completeAuth(response, signIn);
    if (!ok) {
      onClose();
      router.push('/verify-2fa');
      return;
    }
    if (wasRegister) {
      setShowOnboarding(true);
    } else {
      onClose();
    }
  };

  return (
    <>
      <OnboardingPreferencesModal
        open={showOnboarding}
        onComplete={() => {
          setShowOnboarding(false);
          onClose();
        }}
      />

      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-zinc-950/75 backdrop-blur-md animate-in fade-in duration-200"
        onClick={onClose}
      >
        <div
          role="dialog"
          aria-modal="true"
          onClick={(e) => e.stopPropagation()}
          className="relative flex w-full max-w-4xl max-h-[92vh] overflow-hidden rounded-3xl border border-line bg-card shadow-2xl transition-all"
        >
          {/* Bouton de fermeture de la modale en haut à droite */}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClose();
            }}
            aria-label="Fermer"
            className="absolute right-4 top-4 z-20 flex size-9 items-center justify-center rounded-full bg-container-low text-ink-muted transition-colors hover:bg-container hover:text-ink cursor-pointer"
          >
            <X className="size-4" />
          </button>

          {/* ── COLONNE GAUCHE (Image tech de fond avec overlay sombre professionnel) ── */}
          <div className="relative hidden w-2/5 flex-col justify-between overflow-hidden p-8 text-white md:flex border-r border-zinc-800/70 bg-zinc-950">
            {/* Image de fond tech/code haute résolution */}
            <div
              className="absolute inset-0 bg-cover bg-center transition-transform duration-700 scale-105"
              style={{
                backgroundImage:
                  "url('https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=1200&q=80')",
              }}
            />
            {/* Overlay sombre dégradé pour garantir une lisibilité parfaite des textes */}
            <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/85 to-zinc-950/70 backdrop-blur-[1px]" />

            {/* En-tête : Logo */}
            <div className="relative z-10 flex items-center gap-2.5">
              <span className="flex size-10 items-center justify-center rounded-xl bg-zinc-900 border border-zinc-800">
                <LogoMark size={26} />
              </span>
              <span className="text-xl font-black tracking-tight text-white">
                afridev<span className="text-primary">.</span>
              </span>
            </div>

            {/* Corps selon Login ou Register (façon Pixabay) */}
            <div className="relative z-10 space-y-6 my-auto py-6">
              {mode === 'login' ? (
                <div className="space-y-3">
                  <h3 className="text-3xl font-black tracking-tight text-white leading-tight">
                    Welcome back!
                  </h3>
                  <p className="text-sm text-zinc-400 leading-relaxed">
                    Nous avons hâte de voir ce que vous allez partager aujourd&apos;hui.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <h3 className="text-2xl font-black tracking-tight text-white leading-snug">
                    Rejoignez la plus grande communauté de développeurs
                  </h3>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Accédez aux discussions tech, snippets hors-ligne, projets open-source et entraide.
                  </p>

                  <div className="space-y-2.5 pt-2 text-xs text-zinc-300 font-medium">
                    <div className="flex items-center gap-2.5">
                      <span className="flex size-6 items-center justify-center rounded-lg bg-zinc-800/80 text-zinc-300">
                        <Terminal className="size-3.5" />
                      </span>
                      <span>+10 000 Développeurs connectés</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <span className="flex size-6 items-center justify-center rounded-lg bg-zinc-800/80 text-zinc-300">
                        <Layers className="size-3.5" />
                      </span>
                      <span>Snippets & Architectures prêts à l&apos;emploi</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <span className="flex size-6 items-center justify-center rounded-lg bg-zinc-800/80 text-zinc-300">
                        <MessagesSquare className="size-3.5" />
                      </span>
                      <span>Entraide Q&amp;A accélérée par l&apos;IA</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Pied gauche */}
            <div className="relative z-10 text-[11px] text-zinc-500">
              AfriDev Exchange &copy; {new Date().getFullYear()} — Fait pour les créateurs tech.
            </div>
          </div>

          {/* ── COLONNE DROITE (Formulaire façon Pixabay avec boutons sociaux en haut) ── */}
          <div className="flex flex-1 flex-col justify-between overflow-y-auto p-6 sm:p-8 md:p-10">
            <div className="space-y-6">
              {/* Titre */}
              <div className="space-y-1 pr-6">
                <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-ink">
                  {mode === 'login' ? 'Connexion à AfriDev' : 'Créer un compte'}
                </h2>
                <p className="text-xs text-ink-muted">
                  {mode === 'login'
                    ? 'Connectez-vous pour continuer sur la plateforme.'
                    : 'Rejoignez la communauté gratuitement en quelques secondes.'}
                </p>
              </div>

              {/* Boutons Sociaux (Google / GitHub) façon Pixabay */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row gap-2.5">
                  <button
                    type="button"
                    onClick={() => startOAuth('google')}
                    className="flex h-11 flex-1 items-center justify-center gap-2.5 rounded-full border border-line-strong bg-card px-4 text-xs font-semibold text-ink shadow-xs transition-all hover:bg-container hover:border-ink/30 cursor-pointer"
                  >
                    <GoogleIcon />
                    <span>Continuer avec Google</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => startOAuth('github')}
                    className="flex h-11 flex-1 items-center justify-center gap-2.5 rounded-full border border-line-strong bg-card px-4 text-xs font-semibold text-ink shadow-xs transition-all hover:bg-container hover:border-ink/30 cursor-pointer"
                  >
                    <GitHubIcon />
                    <span>Continuer avec GitHub</span>
                  </button>
                </div>

                {/* Séparateur élégant "ou continuer avec" */}
                <div className="relative flex items-center justify-center py-2">
                  <div className="w-full border-t border-line" />
                  <span className="absolute bg-card px-3 text-[0.7rem] font-medium text-ink-muted">
                    {mode === 'login' ? 'ou continuer avec' : 'ou s’inscrire avec'}
                  </span>
                </div>
              </div>

              {/* Formulaire Email/Username + Password */}
              <ModalCredentialsForm
                mode={mode}
                onSuccess={(response) => handleAuthSuccess(response, mode === 'register')}
              />
            </div>

            {/* Pied : Bascule Login / Inscription & Mentions */}
            <div className="space-y-3 border-t border-line/60 pt-4 mt-6 text-center text-xs">
              <p className="text-ink-muted">
                {mode === 'login' ? 'Vous n’avez pas de compte ? ' : 'Vous avez déjà un compte ? '}
                <button
                  type="button"
                  onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
                  className="font-bold text-primary hover:underline cursor-pointer"
                >
                  {mode === 'login' ? 'Rejoindre AfriDev' : 'Se connecter'}
                </button>
              </p>

              <p className="text-[11px] text-ink-faint leading-relaxed">
                En continuant, vous acceptez nos Conditions d&apos;utilisation et notre Politique de confidentialité.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function ModalCredentialsForm({
  mode,
  onSuccess,
}: {
  mode: AuthModalMode;
  onSuccess: (response: AuthResponse) => void;
}) {
  const [form, setForm] = useState({ identifier: '', username: '', email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const updateField = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [field]: e.target.value });
    if (error) setError(null);
  };

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
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-xl border border-danger/30 bg-danger-soft p-3 text-xs text-on-danger-soft animate-in fade-in"
        >
          <AlertCircle className="size-4 shrink-0 text-danger mt-0.5" />
          <span className="flex-1 font-medium">{error}</span>
        </div>
      )}

      {mode === 'login' ? (
        <div className="space-y-1.5">
          <label htmlFor="modal-identifier" className="block text-xs font-semibold text-ink">
            Nom d&apos;utilisateur ou e-mail
          </label>
          <input
            id="modal-identifier"
            type="text"
            required
            autoComplete="username"
            placeholder="ex: amadou ou amadou@gmail.com"
            value={form.identifier}
            onChange={updateField('identifier')}
            className="h-11 w-full rounded-xl border border-line-strong bg-card px-3.5 text-xs text-ink placeholder:text-ink-faint transition-all hover:border-ink/30 focus:border-primary focus:ring-4 focus:ring-primary/12 focus:outline-none"
          />
        </div>
      ) : (
        <>
          <div className="space-y-1.5">
            <label htmlFor="modal-username" className="block text-xs font-semibold text-ink">
              Nom d&apos;utilisateur
            </label>
            <input
              id="modal-username"
              type="text"
              required
              autoComplete="username"
              pattern="[A-Za-z0-9_]{3,30}"
              placeholder="ex: amadou_dev"
              value={form.username}
              onChange={updateField('username')}
              className="h-11 w-full rounded-xl border border-line-strong bg-card px-3.5 text-xs text-ink placeholder:text-ink-faint transition-all hover:border-ink/30 focus:border-primary focus:ring-4 focus:ring-primary/12 focus:outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="modal-email" className="block text-xs font-semibold text-ink">
              E-mail
            </label>
            <input
              id="modal-email"
              type="email"
              required
              autoComplete="email"
              placeholder="amadou@exemple.com"
              value={form.email}
              onChange={updateField('email')}
              className="h-11 w-full rounded-xl border border-line-strong bg-card px-3.5 text-xs text-ink placeholder:text-ink-faint transition-all hover:border-ink/30 focus:border-primary focus:ring-4 focus:ring-primary/12 focus:outline-none"
            />
          </div>
        </>
      )}

      {/* Mot de passe avec oeil unique */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label htmlFor="modal-password" className="block text-xs font-semibold text-ink">
            Mot de passe
          </label>
          {mode === 'login' && (
            <span className="text-[11px] text-ink-muted hover:text-primary transition-colors cursor-pointer">
              Mot de passe oublié ?
            </span>
          )}
        </div>
        <div className="relative">
          <input
            id="modal-password"
            type={showPassword ? 'text' : 'password'}
            required
            minLength={mode === 'register' ? 8 : undefined}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            placeholder="••••••••"
            value={form.password}
            onChange={updateField('password')}
            className="h-11 w-full rounded-xl border border-line-strong bg-card pl-3.5 pr-10 text-xs text-ink placeholder:text-ink-faint transition-all hover:border-ink/30 focus:border-primary focus:ring-4 focus:ring-primary/12 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            tabIndex={-1}
            aria-label={showPassword ? 'Masquer' : 'Afficher'}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink transition-colors cursor-pointer p-1"
          >
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>

        {/* Strength meter façon Pixabay */}
        {mode === 'register' && form.password.length > 0 && (
          <div className="space-y-1 pt-1">
            <div className="flex h-1.5 w-full gap-1 overflow-hidden rounded-full bg-container">
              <div
                className={cn(
                  'h-full flex-1 rounded-full transition-all duration-300',
                  passwordStats.score >= 1
                    ? passwordStats.score <= 2
                      ? 'bg-danger'
                      : passwordStats.score === 3
                        ? 'bg-tertiary'
                        : 'bg-orange-600'
                    : 'bg-transparent',
                )}
              />
              <div
                className={cn(
                  'h-full flex-1 rounded-full transition-all duration-300',
                  passwordStats.score >= 3
                    ? passwordStats.score === 3
                      ? 'bg-tertiary'
                      : 'bg-orange-600'
                    : 'bg-transparent',
                )}
              />
              <div
                className={cn(
                  'h-full flex-1 rounded-full transition-all duration-300',
                  passwordStats.score >= 4 ? 'bg-orange-600' : 'bg-transparent',
                )}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-ink-muted">
              <span>Robustesse</span>
              <span>8+ caractères, dont un chiffre</span>
            </div>
          </div>
        )}
      </div>

      {/* Bouton de soumission vert façon Pixabay */}
      <button
        type="submit"
        disabled={loading}
        className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-orange-600 px-4 text-xs font-bold text-white shadow-md transition-all hover:bg-orange-500 active:scale-[0.99] cursor-pointer disabled:opacity-50 mt-2"
      >
        {loading ? (
          <Spinner className="size-4 text-white" />
        ) : mode === 'login' ? (
          <span>Se connecter</span>
        ) : (
          <span>Créer mon compte gratuitement</span>
        )}
      </button>
    </form>
  );
}
