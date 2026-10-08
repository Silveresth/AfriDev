'use client';

import { PanelLeftClose, PanelLeftOpen, Settings, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { useLang } from '@/shared/i18n';
import { cn, formatBytes } from '@/shared/lib';
import { useIsOnline, useStorageEstimate } from '@/shared/offline';
import { useSession } from '@/shared/session';
import { Kbd } from '@/shared/ui';

import { isActive, NAV_ITEMS, NAV_SECTIONS, type NavItem, navItemClasses, navPath } from './nav';

/** Budget indicatif de la copie locale (cache, brouillons, coffre) affiché dans la jauge. */
export const LOCAL_BUDGET = 50 * 1024 * 1024;

const byHref = (href: string) => NAV_ITEMS.find((item) => item.href === href)!;

/**
 * Colonne de gauche : rubriques regroupées (avec leur raccourci G + touche),
 * hubs, puis l'état de la copie locale. Repliée, elle devient un rail d'icônes.
 */
export function SideNav({
  communities,
  collapsed = false,
  onToggle,
  showShortcuts = true,
}: {
  communities?: React.ReactNode;
  collapsed?: boolean;
  /** Absent dans le tiroir du téléphone (pas de rail replié). */
  onToggle?: () => void;
  showShortcuts?: boolean;
}) {
  const { user, profile } = useSession();
  const { t } = useLang();
  const pathname = navPath(usePathname(), profile?.username);

  return (
    <nav aria-label="Navigation principale" className="flex min-h-full flex-col gap-4">
      {NAV_SECTIONS.map((section) => (
        <div key={section.title ?? 'main'}>
          {section.title ? (
            collapsed ? (
              <div className="mx-3 mb-2 h-px bg-line" aria-hidden />
            ) : (
              <p className="mb-1 px-3 text-label-md font-medium text-ink-faint">
                {section.msgKey ? t(section.msgKey) : section.title}
              </p>
            )
          ) : null}
          <ul className="space-y-0.5">
            {section.hrefs.map((href) => (
              <li key={href}>
                <NavLink item={byHref(href)} pathname={pathname} collapsed={collapsed} showShortcut={showShortcuts} />
              </li>
            ))}
          </ul>
        </div>
      ))}

      {collapsed ? null : communities}

      <div className="mt-auto space-y-2 pt-2">
        <ul className="space-y-0.5">
          <li>
            <NavLink
              item={{ href: '/settings', label: t('nav.settings'), short: t('nav.settings'), icon: Settings, msgKey: 'nav.settings' }}
              pathname={pathname}
              collapsed={collapsed}
            />
          </li>
          {user?.is_staff ? (
            <li>
              <NavLink
                item={{ href: '/admin', label: t('nav.admin'), short: t('nav.admin'), icon: ShieldCheck, msgKey: 'nav.admin' }}
                pathname={pathname}
                collapsed={collapsed}
              />
            </li>
          ) : null}
        </ul>
        <StatusPanel collapsed={collapsed} onToggle={onToggle} />
      </div>
    </nav>
  );
}

function NavLink({
  item,
  pathname,
  collapsed,
  showShortcut = false,
}: {
  item: NavItem;
  pathname: string;
  collapsed: boolean;
  showShortcut?: boolean;
}) {
  const { t } = useLang();
  const active = isActive(pathname, item.href);
  const label = item.msgKey ? t(item.msgKey) : item.label;

  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      aria-label={collapsed ? label : undefined}
      title={collapsed ? label : undefined}
      className={cn(navItemClasses(active), collapsed ? 'mx-auto w-12 justify-center' : 'px-4')}
    >
      <item.icon
        className={cn(
          'size-[18px] shrink-0 transition-colors',
          active ? 'text-primary' : 'text-ink-faint group-hover:text-ink-muted',
        )}
        strokeWidth={active ? 2.25 : 2}
        aria-hidden
      />
      {collapsed ? null : (
        <>
          <span className="flex-1 truncate">{label}</span>
          {showShortcut && item.key ? (
            <span className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden>
              <Kbd>G</Kbd>
              <Kbd>{item.key.toUpperCase()}</Kbd>
            </span>
          ) : null}
        </>
      )}
    </Link>
  );
}

/** Pied de colonne façon barre d'état d'éditeur : réseau, copie locale, repli de la colonne. */
function StatusPanel({ collapsed, onToggle }: { collapsed: boolean; onToggle?: () => void }) {
  const pathname = usePathname();
  const online = useIsOnline();
  const storage = useStorageEstimate(pathname.length);
  const ratio = storage ? Math.min(100, Math.max(2, (storage.usage / LOCAL_BUDGET) * 100)) : 0;
  const ToggleIcon = collapsed ? PanelLeftOpen : PanelLeftClose;
  const toggleLabel = collapsed ? 'Déplier la colonne' : 'Replier la colonne';

  const dot = (
    <span className="relative flex size-2" aria-hidden>
      {online ? <span className="absolute inset-0 animate-ping rounded-full bg-secondary opacity-40 motion-reduce:hidden" /> : null}
      <span className={cn('relative size-2 rounded-full', online ? 'bg-secondary' : 'bg-offline')} />
    </span>
  );

  if (collapsed) {
    return (
      <div className="flex flex-col items-center gap-2 pt-1">
        <span title={online ? 'En ligne' : 'Hors ligne'} className="flex size-10 items-center justify-center">
          {dot}
          <span className="sr-only">{online ? 'En ligne' : 'Hors ligne'}</span>
        </span>
        {onToggle ? (
          <button
            type="button"
            onClick={onToggle}
            aria-label={toggleLabel}
            title={`${toggleLabel} ( [ )`}
            className="flex size-10 items-center justify-center rounded-full text-ink-faint transition-colors hover:bg-shell-hover hover:text-ink"
          >
            <ToggleIcon className="size-[18px]" aria-hidden />
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-card/60 p-3 ring-1 ring-line/60">
      <div className="flex items-center gap-2">
        {dot}
        <span className="flex-1 text-label-md font-medium text-ink-muted">
          {online ? 'En ligne' : 'Hors ligne, modifications gardées ici'}
        </span>
        {onToggle ? (
          <button
            type="button"
            onClick={onToggle}
            aria-label={toggleLabel}
            title={`${toggleLabel} ( [ )`}
            className="-my-1 -mr-1 flex size-7 items-center justify-center rounded-md text-ink-faint transition-colors hover:bg-container hover:text-ink"
          >
            <ToggleIcon className="size-4" aria-hidden />
          </button>
        ) : null}
      </div>
      {storage ? (
        <div className="mt-2.5 space-y-1.5" title="Copie locale : fil, brouillons et coffre disponibles hors ligne">
          <div className="flex justify-between text-label-sm text-ink-faint">
            <span>Copie hors ligne</span>
            <span className="tabular-nums">
              {formatBytes(storage.usage)} / {formatBytes(LOCAL_BUDGET)}
            </span>
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-container-high">
            <div className="h-full rounded-full bg-secondary transition-[width]" style={{ width: `${ratio}%` }} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
