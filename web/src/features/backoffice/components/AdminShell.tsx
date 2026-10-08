'use client';

import { ArrowLeft, Gauge, ShieldAlert, ShieldCheck, Users } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/shared/lib';
import { RequireAuth, useSession } from '@/shared/session';
import { Avatar, ButtonLink, CardSkeleton, CountBadge, EmptyState, LogoMark } from '@/shared/ui';

import { useOpenReportCount } from '../api';

const NAV = [
  { href: '/admin', label: 'Tableau de bord', icon: Gauge },
  { href: '/admin/moderation', label: 'Modération', icon: ShieldAlert },
  { href: '/admin/members', label: 'Membres', icon: Users },
] as const;

/** Espace d'administration : réservé à l'équipe (is_staff), avec son propre cadre. */
export function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <StaffOnly>
        <div className="min-h-dvh bg-surface">
          <AdminNav />
          <main id="contenu" className="mx-auto w-full max-w-[1280px] px-4 pb-16 pt-6 lg:pl-72 lg:pr-8">
            {children}
          </main>
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
          title="Espace réservé à l'équipe de modération"
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

function AdminNav() {
  const pathname = usePathname();
  const { user, profile } = useSession();
  const openReports = useOpenReportCount();
  const isActive = (href: string) => (href === '/admin' ? pathname === href : pathname.startsWith(href));

  return (
    <>
      {/* Desktop : barre latérale sombre, pour distinguer l'administration du site public. */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 flex-col justify-between bg-code-bg px-4 py-5 text-white lg:flex">
        <div className="space-y-6">
          <Link href="/admin" className="flex items-center gap-2.5" aria-label="Back-office AfriDev">
            <LogoMark size={32} />
            <span className="leading-tight">
              <span className="block font-semibold">AfriDev</span>
              <span className="block text-label-md text-white/60">Back-office</span>
            </span>
          </Link>
          <nav aria-label="Administration" className="space-y-1">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive(item.href) ? 'page' : undefined}
                className={cn(
                  'flex min-h-10 items-center gap-3 rounded-full px-2.5 text-body-md transition-colors',
                  isActive(item.href) ? 'bg-white/12 font-semibold text-white' : 'text-white/70 hover:bg-white/8 hover:text-white',
                )}
              >
                <item.icon className="size-5" aria-hidden />
                <span className="flex-1">{item.label}</span>
                {item.href === '/admin/moderation' && openReports ? (
                  <CountBadge count={openReports} />
                ) : null}
              </Link>
            ))}
          </nav>
        </div>
        <div className="space-y-3">
          <div className="flex items-center gap-2 rounded bg-white/6 p-2">
            <Avatar name={profile?.display_name || user?.username || '?'} src={profile?.avatar_url} size={32} />
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-body-sm font-semibold">{profile?.display_name || user?.username}</span>
              <span className="block text-label-md text-white/60">
                {user?.is_superuser ? 'Administrateur' : 'Modération'}
              </span>
            </span>
          </div>
          <Link href="/feed" className="flex min-h-10 items-center gap-2 rounded-full px-2.5 text-body-sm text-white/70 hover:bg-white/8 hover:text-white">
            <ArrowLeft className="size-4" aria-hidden /> Retour au site
          </Link>
        </div>
      </aside>

      {/* Mobile : en-tête et onglets. */}
      <header className="sticky top-0 z-20 border-b border-line bg-code-bg text-white lg:hidden">
        <div className="flex h-14 items-center gap-3 px-4">
          <LogoMark size={28} />
          <span className="flex-1 font-semibold">Back-office</span>
          <Link href="/feed" className="flex min-h-10 items-center gap-1 text-body-sm text-white/70" aria-label="Retour au site">
            <ArrowLeft className="size-4" aria-hidden /> Site
          </Link>
        </div>
        <nav aria-label="Administration" className="flex gap-1 overflow-x-auto px-2 pb-2">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(item.href) ? 'page' : undefined}
              className={cn(
                'flex min-h-10 shrink-0 items-center gap-2 rounded-full px-3 text-body-sm',
                isActive(item.href) ? 'bg-white/15 font-semibold' : 'text-white/70',
              )}
            >
              <item.icon className="size-4" aria-hidden />
              {item.label}
              {item.href === '/admin/moderation' && openReports ? (
                <CountBadge count={openReports} />
              ) : null}
            </Link>
          ))}
        </nav>
      </header>
    </>
  );
}
