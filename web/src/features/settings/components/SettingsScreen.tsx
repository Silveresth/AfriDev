'use client';

import { Bell, HardDrive, Lock, Palette, UserRound } from 'lucide-react';
import { useEffect, useState } from 'react';

import { type MessageKey, useLang } from '@/shared/i18n';
import { cn } from '@/shared/lib';
import { useSession } from '@/shared/session';

import { AccountSection } from './AccountSection';
import { DataSection } from './DataSection';
import { DisplaySection } from './DisplaySection';
import { NotificationsTab } from './NotificationsTab';
import { PrivacyTab } from './PrivacyTab';

type SectionId = 'account' | 'notifications' | 'display' | 'data' | 'privacy';

const SECTIONS: Array<{ id: SectionId; label: MessageKey; icon: typeof Bell; auth: boolean }> = [
  { id: 'account', label: 'settings.nav.account', icon: UserRound, auth: true },
  { id: 'notifications', label: 'settings.tab.notifications', icon: Bell, auth: true },
  { id: 'display', label: 'settings.nav.display', icon: Palette, auth: false },
  { id: 'data', label: 'settings.nav.data', icon: HardDrive, auth: false },
  { id: 'privacy', label: 'settings.tab.privacy', icon: Lock, auth: true },
];

function isSection(value: string): value is SectionId {
  return SECTIONS.some((section) => section.id === value);
}

/**
 * Réglages : une colonne de navigation (capsules défilantes sur téléphone) et une section à la
 * fois. La section suit l'ancre de l'URL (/settings#notifications) : lien direct et retour arrière.
 */
export function SettingsScreen() {
  const { isAuthenticated } = useSession();
  const { t } = useLang();
  const available = SECTIONS.filter((section) => isAuthenticated || !section.auth);
  const fallback = available[0]!.id;
  const [requested, setRequested] = useState<SectionId | null>(null);

  useEffect(() => {
    const read = () => {
      const hash = window.location.hash.slice(1);
      setRequested(isSection(hash) ? hash : null);
    };
    read();
    window.addEventListener('hashchange', read);
    return () => window.removeEventListener('hashchange', read);
  }, []);

  const current = requested && available.some((section) => section.id === requested) ? requested : fallback;
  const open = (id: SectionId) => {
    window.history.replaceState(null, '', `#${id}`);
    setRequested(id);
  };

  return (
    <div className="mx-auto max-w-5xl pb-12">
      <header className="mb-6 space-y-1">
        <h1 className="text-headline-lg text-ink">{t('settings.title')}</h1>
        <p className="text-body-sm text-ink-muted">{t('settings.subtitle')}</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[13rem_1fr]">
        <nav aria-label={t('settings.title')} className="lg:sticky lg:top-20 lg:self-start">
          <ul className="scrollbar-none -mx-4 flex gap-1.5 overflow-x-auto px-4 lg:mx-0 lg:flex-col lg:gap-0.5 lg:px-0">
            {available.map((section) => {
              const active = section.id === current;
              return (
                <li key={section.id} className="shrink-0">
                  <button
                    type="button"
                    onClick={() => open(section.id)}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex h-9 w-full items-center gap-2.5 rounded-full px-3.5 text-body-sm font-medium whitespace-nowrap transition-colors lg:rounded-lg',
                      active
                        ? 'bg-card text-ink shadow-card ring-1 ring-line lg:bg-container lg:shadow-none lg:ring-0'
                        : 'text-ink-muted hover:bg-container-low hover:text-ink',
                    )}
                  >
                    <section.icon className={cn('size-4', active ? 'text-primary' : 'text-ink-faint')} aria-hidden />
                    {t(section.label)}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="min-w-0 space-y-6">
          {current === 'account' && <AccountSection />}
          {current === 'notifications' && <NotificationsTab />}
          {current === 'display' && <DisplaySection />}
          {current === 'data' && <DataSection />}
          {current === 'privacy' && <PrivacyTab />}
        </div>
      </div>
    </div>
  );
}
