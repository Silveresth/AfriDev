'use client';

import { ArrowLeft, Gauge, Layers, type LucideIcon, ShieldAlert, ShieldCheck, Users } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { navItemClasses } from '@/shared/layout';
import { cn } from '@/shared/lib';
import { RequireAuth, useSession } from '@/shared/session';
import { Avatar, ButtonLink, CardSkeleton, CountBadge, EmptyState, Logo } from '@/shared/ui';

import { useOpenReportCount } from '../api';

interface AdminNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const SECTIONS: Array<{ title: string; items: AdminNavItem[] }> = [
  { title: 'Pilotage', items: [{ href: '/admin', label: 'Tableau de bord', icon: Gauge }] },
  {
    title: 'Gestion',
    items: [
      { href: '/admin/moderation', label: 'Modération', icon: ShieldAlert },
      { href: '/admin/content', label: 'Contenus', icon: Layers },
      { href: '/admin/members', label: 'Membres', icon: Users },
    ],
  },
];

const ALL_ITEMS = SECTIONS.flatMap((section) => section.items);

/** Back-office : même cadre que le site (barre du haut, colonne de gauche, feuille centrale). */
export function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <StaffOnly>
        <div className="min-h-dvh bg-shell">
          <TopBar />
          <MobileTabs />
          <div className="mx-auto flex w-full max-w-[1440px]">
            <aside className="scrollbar-none sticky top-16 hidden h-[calc(100dvh-4rem)] w-64 shrink-0 overflow-y-auto px-3 pt-2 pb-4 lg:block">
              <SideNav />
            </aside>
            <main
              id="contenu"
              className="min-h-[calc(100dvh-4rem)] min-w-0 flex-1 rounded-t-3xl bg-surface px-4 py-6 pb-16 sm:px-8 lg:mr-3 lg:px-10 lg:py-8"
            >
              {children}
            </main>
          </div>
        </div>
      </StaffOnly>
    </RequireAuth>
  );
}

function StaffOnly({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useSession();
  if (isLoading || !user) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <CardSkeleton lines={4} />
      </div>
    );
  }
  if (!user.is_staff) {
    return (
      <div className="mx-auto max-w-xl p-6 pt-16">
        <EmptyState
          icon={<ShieldCheck className="size-8" aria-hidden />}
          title="Espace réservé à l'équipe AfriDev"
          action={<ButtonLink href="/feed">Retour au fil</ButtonLink>}
        >
          Votre compte n&apos;a pas accès au back-office. Demandez à un administrateur de vous ajouter à
          l&apos;équipe.
        </EmptyState>
      </div>
    );
  }
  return <>{children}</>;
}

function useActive() {
  const pathname = usePathname();
  return (href: string) => (href === '/admin' ? pathname === href : pathname.startsWith(href));
}

function TopBar() {
  const { user, profile } = useSession();
  const name = profile?.display_name || user?.username || '?';
  return (
    <header className="sticky top-0 z-30 bg-shell">
      <div className="mx-auto flex h-16 w-full max-w-[1440px] items-center gap-3 px-3 sm:px-4">
        <Link href="/admin" aria-label="Back-office AfriDev" className="flex shrink-0 items-center gap-2.5 rounded-lg lg:w-[15rem] lg:pl-1">
          <Logo />
          <span className="rounded-full bg-primary-soft px-2.5 py-0.5 text-label-md font-semibold text-primary-ink">Admin</span>
        </Link>
        <div className="flex-1" />
        <Link
          href="/feed"
          className="hidden h-9 items-center gap-1.5 rounded-full border border-line bg-card px-3.5 text-body-sm font-medium text-ink-muted transition-colors hover:text-ink sm:flex"
        >
          <ArrowLeft className="size-4" aria-hidden /> Retour au site
        </Link>
        <span className="flex items-center gap-2 rounded-full border border-line bg-card py-1 pr-3 pl-1">
          <Avatar name={name} src={profile?.avatar_url} size={28} />
          <span className="hidden leading-tight sm:block">
            <span className="block max-w-36 truncate text-body-sm font-semibold text-ink">{name}</span>
            <span className="block text-label-sm text-ink-faint">{user?.is_superuser ? 'Administrateur' : 'Modération'}</span>
          </span>
        </span>
      </div>
    </header>
  );
}

function SideNav() {
  const isActive = useActive();
  const openReports = useOpenReportCount();
  return (
    <nav aria-label="Administration" className="flex min-h-full flex-col gap-5">
      {SECTIONS.map((section) => (
        <div key={section.title}>
          <p className="mb-1 px-4 text-label-md font-medium text-ink-faint">{section.title}</p>
          <ul className="space-y-0.5">
            {section.items.map((item) => {
              const active = isActive(item.href);
              return (
                <li key={item.href}>
                  <Link href={item.href} aria-current={active ? 'page' : undefined} className={navItemClasses(active)}>
                    <item.icon
                      className={cn('size-[18px] shrink-0', active ? 'text-primary' : 'text-ink-faint group-hover:text-ink-muted')}
                      strokeWidth={active ? 2 : 1.75}
                      aria-hidden
                    />
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.href === '/admin/moderation' && openReports ? <CountBadge count={openReports} /> : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      <div className="mt-auto rounded-2xl border border-line bg-card p-4">
        <p className="flex items-center gap-2 text-body-sm font-semibold text-ink">
          <ShieldCheck className="size-4 text-secondary" aria-hidden /> Espace sécurisé
        </p>
        <p className="mt-1 text-label-md text-ink-muted">Accès réservé à l&apos;équipe ; chaque action est vérifiée par l&apos;API.</p>
      </div>
    </nav>
  );
}

function MobileTabs() {
  const isActive = useActive();
  const openReports = useOpenReportCount();
  return (
    <nav aria-label="Administration" className="scrollbar-none sticky top-16 z-20 flex gap-1.5 overflow-x-auto bg-shell px-3 pb-2 lg:hidden">
      {ALL_ITEMS.map((item) => {
        const active = isActive(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex h-9 shrink-0 items-center gap-2 rounded-full px-3.5 text-body-sm',
              active ? 'bg-primary-soft font-semibold text-primary-ink' : 'bg-card text-ink-muted',
            )}
          >
            <item.icon className="size-4" aria-hidden />
            {item.label}
            {item.href === '/admin/moderation' && openReports ? <CountBadge count={openReports} /> : null}
          </Link>
        );
      })}
    </nav>
  );
}
