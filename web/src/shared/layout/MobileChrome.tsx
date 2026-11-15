'use client';

/**
 * Cadre du site sur téléphone et tablette (< 1024 px), calqué sur l'appli mobile :
 * - en-tête d'écran (mobile/src/shared/ui/Header.tsx) : 56 px, filet fin, grand titre à gauche
 *   pour les onglets, flèche retour + titre pour les écrans empilés ;
 * - barre d'onglets (mobile/src/app/(tabs)/_layout.tsx) : 5 onglets, pastille teintée sous l'icône ;
 * - bouton rond « + » et feuille « Créer » (mobile/src/shared/layout/CreateButton.tsx).
 */

import {
  ArrowLeft,
  ChevronRight,
  Code2,
  LayoutGrid,
  type LucideIcon,
  MessageCircleQuestion,
  PenLine,
  Plus,
  Search,
  Settings,
  Sparkles,
  UsersRound,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, useSyncExternalStore } from 'react';

import { useLang } from '@/shared/i18n';
import { cn } from '@/shared/lib';
import { useSession } from '@/shared/session';
import { buttonClasses } from '@/shared/ui';

import { openCommandPalette } from './command';
import { MOBILE_TABS, mobileScreen, navPath } from './nav';

const DESKTOP_QUERY = '(min-width: 1024px)';

function subscribeDesktop(callback: () => void) {
  const media = window.matchMedia(DESKTOP_QUERY);
  media.addEventListener('change', callback);
  return () => media.removeEventListener('change', callback);
}

/** Vrai à partir de 1024 px (colonne de gauche visible). Côté serveur : faux (téléphone d'abord). */
export function useIsDesktop() {
  return useSyncExternalStore(subscribeDesktop, () => window.matchMedia(DESKTOP_QUERY).matches, () => false);
}

/** Bouton icône rond de 40 px, comme IconButton de l'appli (pastille de compteur en option). */
export function AppIconButton({
  icon: Icon,
  label,
  href,
  onClick,
  badge,
}: {
  icon: LucideIcon;
  label: string;
  href?: string;
  onClick?: () => void;
  badge?: number;
}) {
  const className =
    'relative flex size-10 shrink-0 items-center justify-center rounded-full text-ink transition-transform active:scale-[0.85] active:bg-container';
  const content = (
    <>
      <Icon className="size-[22px]" strokeWidth={2} aria-hidden />
      {badge ? (
        <span className="absolute top-1 right-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-app bg-primary px-1 text-[10px] leading-3 font-bold text-on-primary tabular-nums">
          {badge > 99 ? '99+' : badge}
        </span>
      ) : null}
    </>
  );
  return href ? (
    <Link href={href} aria-label={label} title={label} className={className}>
      {content}
    </Link>
  ) : (
    <button type="button" onClick={onClick} aria-label={label} title={label} className={className}>
      {content}
    </button>
  );
}

/** En-tête d'écran du téléphone. Les actions dépendent de l'onglet, comme dans l'appli. */
export function MobileAppBar({
  notifications,
  messages,
  themeToggle,
  onMenu,
  onLogin,
}: {
  notifications?: React.ReactNode;
  messages?: React.ReactNode;
  themeToggle?: React.ReactNode;
  onMenu: () => void;
  onLogin: () => void;
}) {
  const router = useRouter();
  const { t } = useLang();
  const { isAuthenticated, profile } = useSession();
  const pathname = navPath(usePathname(), profile?.username);
  const { tab, title } = mobileScreen(pathname);

  // Rien derrière (lien ouvert directement) : retour à l'accueil, comme l'appli.
  const back = () => (window.history.length > 1 ? router.back() : router.push('/feed'));

  let actions: React.ReactNode = null;
  if (tab === '/feed') {
    actions = isAuthenticated ? (
      <>
        <AppIconButton icon={Sparkles} label="Assistant IA" href="/assistant" />
        <AppIconButton icon={Search} label={t('nav.search')} onClick={openCommandPalette} />
        {messages}
        {notifications}
      </>
    ) : (
      <>
        <AppIconButton icon={Search} label={t('nav.search')} onClick={openCommandPalette} />
        <button type="button" onClick={onLogin} className={buttonClasses({ size: 'sm', className: 'ml-1 rounded-full' })}>
          {t('auth.login')}
        </button>
      </>
    );
  } else if (tab === '/news') {
    actions = <AppIconButton icon={Search} label={t('nav.search')} onClick={openCommandPalette} />;
  } else if (tab === '/hubs') {
    actions = <AppIconButton icon={Plus} label="Créer un hub" href={isAuthenticated ? '/hubs?create=1' : '/login?next=/hubs'} />;
  } else if (tab === '/profile') {
    actions = (
      <>
        {themeToggle}
        <AppIconButton icon={Settings} label={t('nav.settings')} href="/settings" />
        {/* Propre au site : les rubriques sans onglet (snippets, projets, jobs, événements…). */}
        <AppIconButton icon={LayoutGrid} label={t('nav.menu_open')} onClick={onMenu} />
      </>
    );
  }

  return (
    <div className="flex h-14 items-center gap-1 border-b border-line bg-app px-2">
      {tab ? null : <AppIconButton icon={ArrowLeft} label="Retour" onClick={back} />}
      <p
        className={cn(
          'min-w-0 flex-1 truncate text-ink',
          tab ? 'pl-2 text-[22px] leading-7 font-bold tracking-tight' : 'text-[17px] leading-[23px] font-semibold',
        )}
      >
        {title}
      </p>
      <div className="flex shrink-0 items-center">{actions}</div>
    </div>
  );
}

/** Barre d'onglets du bas : fond uni, filet fin, pastille teintée derrière l'icône active. */
export function MobileTabBar({ onGuestProfile }: { onGuestProfile: () => void }) {
  const { t } = useLang();
  const { isAuthenticated, profile } = useSession();
  const pathname = navPath(usePathname(), profile?.username);
  const { tab } = mobileScreen(pathname);
  // Écran empilé : l'onglet de sa rubrique reste allumé (une question → Q&A).
  const current = tab ?? MOBILE_TABS.find(({ item }) => item.href !== '/feed' && pathname.startsWith(`${item.href}/`))?.item.href;

  return (
    <nav aria-label="Navigation mobile" className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-app pb-[env(safe-area-inset-bottom)] lg:hidden">
      <ul className="flex h-[68px] items-stretch pt-1 pb-1">
        {MOBILE_TABS.map(({ item, title, msgKey }) => {
          const active = current === item.href;
          const label = msgKey ? t(msgKey) : title;
          const className = cn(
            'flex h-full w-full flex-col items-center justify-center gap-0.5 select-none',
            active ? 'text-primary' : 'text-ink-faint',
          );
          const content = (
            <>
              <span className="relative flex h-8 w-14 items-center justify-center">
                <span
                  aria-hidden
                  className={cn(
                    'absolute inset-0 rounded-2xl bg-primary-soft transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]',
                    active ? 'scale-x-100 opacity-100' : 'scale-x-40 opacity-0',
                  )}
                />
                <item.icon
                  className={cn('relative size-[22px] transition-transform duration-200', active && '-translate-y-px animate-tab-pop')}
                  strokeWidth={active ? 2.4 : 1.9}
                  aria-hidden
                />
              </span>
              <span className="text-[11px] leading-[15px] font-semibold">{label}</span>
            </>
          );
          return (
            <li key={item.href} className="flex-1">
              {item.href === '/profile' && !isAuthenticated ? (
                <button type="button" onClick={onGuestProfile} className={className}>
                  {content}
                </button>
              ) : (
                <Link href={item.href} aria-current={active ? 'page' : undefined} className={className}>
                  {content}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

interface Choice {
  href: string;
  title: string;
  hint: string;
  icon: LucideIcon;
  /** Proposé seulement hors d'un hub (on ne crée pas un hub depuis un hub). */
  outsideHub?: boolean;
}

/** Les quatre choix de l'appli, dans le même ordre. */
function useChoices(): Choice[] {
  const { t } = useLang();
  return [
    { href: '/submit', title: t('publish.post'), hint: t('publish.post_hint'), icon: PenLine },
    { href: '/questions/new', title: t('publish.question'), hint: t('publish.question_hint'), icon: MessageCircleQuestion },
    { href: '/snippets/new', title: t('publish.snippet'), hint: t('publish.snippet_hint'), icon: Code2 },
    { href: '/hubs?create=1', title: 'Créer un hub', hint: 'Rassemblez une communauté autour d’un sujet', icon: UsersRound, outsideHub: true },
  ];
}

/** Écrans qui portent le bouton « + » dans l'appli : l'accueil, Q&A (question directe) et un hub. */
function fabTarget(pathname: string): { show: boolean; href?: string; hub?: string } {
  if (pathname === '/' || pathname === '/feed') return { show: true };
  if (pathname === '/questions') return { show: true, href: '/questions/new' };
  const hub = /^\/h\/([^/]+)\/?$/.exec(pathname);
  if (hub) return { show: true, hub: hub[1] };
  return { show: false };
}

/** Bouton rond « + » en bas à droite, au-dessus des onglets ; ouvre la feuille « Créer ». */
export function CreateFab({ onGuest }: { onGuest: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated } = useSession();
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const target = fabTarget(pathname);
  if (!target.show) return null;

  return (
    <>
      <button
        type="button"
        aria-label={t('publish.create')}
        onClick={() => {
          if (!isAuthenticated) return onGuest();
          if (target.href) router.push(target.href);
          else setOpen(true);
        }}
        className="animate-fade-in fixed right-4 bottom-[calc(68px+env(safe-area-inset-bottom)+16px)] z-30 flex size-14 items-center justify-center rounded-full bg-primary text-on-primary shadow-[0_2px_6px_rgba(0,0,0,0.15)] transition-transform active:scale-[0.94] lg:hidden"
      >
        <Plus className="size-[26px]" strokeWidth={2.4} aria-hidden />
      </button>
      <CreateSheet open={open} onClose={() => setOpen(false)} hub={target.hub} />
    </>
  );
}

/** Feuille qui monte du bas sur un voile, comme Sheet de l'appli (220 ms, poignée, titre). */
function CreateSheet({ open, onClose, hub }: { open: boolean; onClose: () => void; hub?: string }) {
  const { t } = useLang();
  const choices = useChoices().filter((choice) => !(hub && choice.outsideHub));
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(false);
  // Ouverture : montée tout de suite (pendant le rendu), puis glissement à l'image suivante.
  if (open && !mounted) setMounted(true);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setShown(open));
    if (open) return () => cancelAnimationFrame(frame);
    // Fermeture : la feuille redescend (220 ms) avant d'être retirée.
    const timer = window.setTimeout(() => setMounted(false), 220);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = original;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!mounted) return null;
  const withHub = (href: string) => (hub ? `${href}${href.includes('?') ? '&' : '?'}hub=${encodeURIComponent(hub)}` : href);

  return (
    <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label={t('publish.create')}>
      <button
        type="button"
        aria-label="Fermer"
        onClick={onClose}
        className={cn('absolute inset-0 bg-[rgba(10,10,11,0.4)] transition-opacity duration-200 dark:bg-black/60', shown ? 'opacity-100' : 'opacity-0')}
      />
      <div
        className={cn(
          'absolute inset-x-0 bottom-0 rounded-t-[20px] bg-app pt-2 pb-[calc(env(safe-area-inset-bottom)+12px)] transition-transform duration-200',
          shown ? 'translate-y-0 ease-out' : 'translate-y-[min(60vh,480px)] ease-in',
        )}
      >
        <span className="mx-auto mb-2 block h-1 w-9 rounded-sm bg-line-strong" aria-hidden />
        <p className="px-5 py-2 text-[17px] leading-[23px] font-semibold text-ink">{t('publish.create')}</p>
        <ul>
          {choices.map((choice) => (
            <li key={choice.href}>
              <Link
                href={withHub(choice.href)}
                onClick={onClose}
                className="flex items-center gap-3.5 px-5 py-3.5 transition-colors active:bg-container"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-primary-soft text-primary-ink">
                  <choice.icon className="size-5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] leading-[22px] font-semibold text-ink">{choice.title}</span>
                  <span className="block truncate text-[13px] leading-[18px] text-ink-muted">{choice.hint}</span>
                </span>
                <ChevronRight className="size-[18px] shrink-0 text-ink-faint" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
