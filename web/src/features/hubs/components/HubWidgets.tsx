'use client';

import { Compass, UsersRound } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { navItemClasses } from '@/shared/layout';
import { cn } from '@/shared/lib';
import { useSession } from '@/shared/session';
import { HubIcon, SideCard, Skeleton } from '@/shared/ui';

import { useHub, useHubs, useMyHubs } from '../api';
import { memberLabel } from './HubCard';
import { JoinButton } from './JoinButton';

/** Menu latéral : mes hubs (ou les plus populaires si je n'en ai rejoint aucun). */
export function HubNav() {
  const { isAuthenticated } = useSession();
  const mine = useMyHubs();
  const popular = useHubs({ sort: 'popular' });
  const pathname = usePathname();
  const showMine = isAuthenticated && mine.items.length > 0;
  const hubs = (showMine ? mine.items : popular.items).slice(0, 8);
  const pending = showMine ? mine.isPending : popular.isPending;

  return (
    <div>
      <p className="mb-1 px-3 text-label-md font-medium text-ink-faint">
        {showMine ? 'Mes hubs' : 'Hubs populaires'}
      </p>
      {pending && !hubs.length ? (
        <Skeleton className="mx-3 h-24" />
      ) : (
        <ul className="space-y-0.5">
          {hubs.map((hub) => {
            const active = pathname === `/h/${hub.slug}`;
            return (
              <li key={hub.id}>
                <Link
                  href={`/h/${hub.slug}`}
                  aria-current={active ? 'page' : undefined}
                  className={cn(navItemClasses(active), 'px-4')}
                >
                  <HubIcon icon={hub.icon} name={hub.name} size={20} className="rounded-md" />
                  <span className="truncate">
                    <span className={active ? 'opacity-60' : 'text-ink-faint'}>h/</span>
                    {hub.slug}
                  </span>
                </Link>
              </li>
            );
          })}
          <li>
            <Link
              href="/hubs"
              className="flex h-9 items-center gap-3 rounded-full px-4 text-body-sm font-medium text-ink-faint transition-colors hover:bg-shell-hover hover:text-ink"
            >
              <Compass className="size-[18px]" aria-hidden /> Explorer les hubs
            </Link>
          </li>
        </ul>
      )}
    </div>
  );
}

/** « Hubs recommandés » (colonne de droite) : les plus populaires que je n'ai pas rejoints. */
export function RecommendedHubsCard() {
  const hubs = useHubs({ sort: 'popular' });
  const items = hubs.items.filter((hub) => !hub.viewer?.is_member).slice(0, 5);
  return (
    <SideCard
      title="Hubs recommandés"
      icon={<UsersRound aria-hidden />}
      action={
        <Link href="/hubs" className="text-label-md font-medium text-ink-faint hover:text-ink">
          Tout voir
        </Link>
      }
    >
      {hubs.isPending ? (
        <div className="px-4 pb-4">
          <Skeleton className="h-28" />
        </div>
      ) : items.length ? (
        <ul className="pb-1.5">
          {items.map((hub) => (
            <li key={hub.id} className="flex items-center gap-3 px-4 py-2">
              <Link href={`/h/${hub.slug}`} className="flex min-w-0 flex-1 items-center gap-3 hover:underline">
                <HubIcon icon={hub.icon} name={hub.name} size={32} className="rounded-lg" />
                <span className="min-w-0">
                  <span className="block truncate text-body-sm font-medium text-ink">h/{hub.slug}</span>
                  <span className="block text-label-md text-ink-faint">{memberLabel(hub.member_count)}</span>
                </span>
              </Link>
              <JoinButton hub={hub} className="h-7 px-2.5" />
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-4 pb-4 text-body-sm text-ink-muted">
          {hubs.items.length ? 'Vous avez rejoint tous les hubs populaires !' : 'Aucun hub pour l’instant : créez le premier.'}
        </p>
      )}
    </SideCard>
  );
}

/** « À propos du hub » (colonne de droite d'un post rangé dans un hub). */
export function HubAboutCard({ slug }: { slug: string }) {
  const hub = useHub(slug);
  if (!hub.data) return <Skeleton className="h-40 rounded-xl" />;
  const data = hub.data;
  return (
    <SideCard>
      <div className="space-y-3 p-4">
        <Link href={`/h/${data.slug}`} className="flex items-center gap-3 hover:underline">
          <HubIcon icon={data.icon} name={data.name} size={40} className="rounded-lg" />
          <span className="min-w-0">
            <span className="block truncate text-headline-md text-ink">{data.name}</span>
            <span className="block text-label-md text-ink-faint">
              h/{data.slug} · {memberLabel(data.member_count)}
            </span>
          </span>
        </Link>
        {data.description ? <p className="text-body-sm text-ink-muted">{data.description}</p> : null}
        <JoinButton hub={data} className="w-full" />
      </div>
    </SideCard>
  );
}
