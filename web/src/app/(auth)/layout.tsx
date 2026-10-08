'use client';

import { ArrowLeft, Code2, MessagesSquare, ShieldCheck, Terminal, Users, WifiOff } from 'lucide-react';
import Link from 'next/link';

import { useLang } from '@/shared/i18n';
import { Logo, LogoMark } from '@/shared/ui';

/** Layout d'authentification : présentation sobre et pro à gauche, formulaire épuré à droite. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const { t } = useLang();

  const features = [
    {
      icon: MessagesSquare,
      title: t('auth.feature1_title'),
      text: t('auth.feature1_desc'),
    },
    {
      icon: Code2,
      title: t('auth.feature2_title'),
      text: t('auth.feature2_desc'),
    },
    {
      icon: WifiOff,
      title: t('auth.feature3_title'),
      text: t('auth.feature3_desc'),
    },
  ];

  return (
    <div className="min-h-dvh bg-surface lg:grid lg:grid-cols-[1.1fr_1fr] xl:grid-cols-[1.15fr_1fr]">
      {/* ── Colonne de gauche (Design sobre & moderne sombre sans dégradé orange) ── */}
      <aside className="relative hidden overflow-hidden bg-zinc-950 p-10 text-white lg:flex lg:flex-col lg:justify-between xl:p-14 border-r border-zinc-800/80">
        {/* Lueur subtile en arrière-plan (très discrète et neutre) */}
        <div className="pointer-events-none absolute -top-40 -left-40 size-96 rounded-full bg-zinc-800/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 right-0 size-96 rounded-full bg-zinc-800/20 blur-3xl" />

        {/* En-tête de marque */}
        <div className="relative z-10">
          <Link href="/" className="inline-flex items-center gap-3 transition-opacity hover:opacity-90" aria-label="AfriDev Exchange — accueil">
            <span className="flex size-11 items-center justify-center rounded-xl bg-zinc-900 border border-zinc-800 shadow-sm">
              <LogoMark size={30} />
            </span>
            <div>
              <span className="text-[1.35rem] font-black tracking-tight text-white">
                afridev<span className="text-primary">.</span>
              </span>
              <span className="block text-[0.68rem] font-semibold tracking-wider text-zinc-400 uppercase">
                Developer Network
              </span>
            </div>
          </Link>
        </div>

        {/* Corps central du showcase */}
        <div className="relative z-10 max-w-lg space-y-8 py-6">
          <div className="space-y-3.5">
            <div className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/90 px-3 py-1 text-xs font-medium text-zinc-300">
              <Terminal className="size-3.5 text-zinc-400" />
              <span>{t('auth.features_badge')}</span>
            </div>

            <h1 className="text-[2.35rem] leading-[1.2] font-extrabold tracking-tight text-white xl:text-[2.65rem]">
              {t('auth.features_headline')}
            </h1>

            <p className="text-sm leading-relaxed text-zinc-400 xl:text-base">
              {t('auth.features_sub')}
            </p>
          </div>

          {/* Cartes d'avantages (style épuré zinc) */}
          <div className="space-y-3">
            {features.map((item) => (
              <div
                key={item.title}
                className="flex items-start gap-3.5 rounded-xl border border-zinc-800/80 bg-zinc-900/50 p-3.5 transition-colors hover:border-zinc-700/80 hover:bg-zinc-900"
              >
                <span className="flex size-9.5 shrink-0 items-center justify-center rounded-lg bg-zinc-800 text-zinc-200 border border-zinc-700/50">
                  <item.icon className="size-4.5" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <span className="block text-xs font-bold text-zinc-100">{item.title}</span>
                  <p className="mt-0.5 text-xs text-zinc-400 leading-relaxed">{item.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Pied de la colonne gauche */}
        <div className="relative z-10 flex items-center justify-between border-t border-zinc-800/80 pt-4 text-xs text-zinc-400">
          <span className="flex items-center gap-1.5 font-medium">
            <Users className="size-3.5 text-zinc-500" />
            {t('auth.community_badge')}
          </span>
          <span className="text-zinc-500">{t('auth.free_badge')}</span>
        </div>
      </aside>

      {/* ── Colonne de droite (Formulaire d'authentification) ── */}
      <div className="flex min-h-dvh flex-col bg-surface">
        <header className="flex items-center justify-between px-4 py-4 sm:px-8 border-b border-line/60">
          <Link
            href="/"
            className="group inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-ink-muted transition-colors hover:bg-container hover:text-ink"
            aria-label={t('nav.home')}
          >
            <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-0.5" aria-hidden />
            <span>{t('nav.home')}</span>
          </Link>

          <Link href="/" className="lg:hidden" aria-label="AfriDev Exchange — accueil">
            <Logo />
          </Link>

          <div className="flex items-center gap-2 text-xs font-medium text-ink-faint">
            <ShieldCheck className="size-4 text-secondary" />
            <span className="hidden sm:inline">{t('auth.secured_badge')}</span>
          </div>
        </header>

        <main className="flex flex-1 items-center justify-center px-4 py-8 sm:px-8">
          <div className="w-full max-w-[420px]">{children}</div>
        </main>

        <footer className="px-6 py-4 text-center text-xs text-ink-faint border-t border-line/40">
          AfriDev Exchange &copy; {new Date().getFullYear()} — {t('auth.features_badge')}
        </footer>
      </div>
    </div>
  );
}
