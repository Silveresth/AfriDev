'use client';

import { Code2, FolderGit2, MessageCircleQuestion, PenSquare, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { useLang } from '@/shared/i18n';
import { cn } from '@/shared/lib';
import { Kbd, Menu, MenuItem } from '@/shared/ui';

import { MobilePublishSheet } from './MobilePublishSheet';
import { PUBLISH_ITEMS } from './nav';

const ICONS = [PenSquare, MessageCircleQuestion, Code2, FolderGit2];

/**
 * Bouton « Créer » adaptatif :
 * - Sur mobile : ouvre une Bottom Sheet tactile native façon iOS / Android.
 * - Sur desktop : menu déroulant accessible avec raccourci clavier « N ».
 */
export function PublishMenu({ compact = false, className }: { compact?: boolean; className?: string }) {
  const router = useRouter();
  const { t } = useLang();
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const typing = target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName);
      if (!typing && !event.metaKey && !event.ctrlKey && !event.altKey && event.key.toLowerCase() === 'n') {
        event.preventDefault();
        router.push('/submit');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [router]);

  if (compact) {
    return (
      <>
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          aria-label={t('nav.publish')}
          className={cn(
            'group relative flex size-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-primary to-amber-500 text-on-primary shadow-lg shadow-primary/25 ring-2 ring-white/20 transition-all duration-200 active:scale-90 hover:brightness-110',
            className,
          )}
        >
          <span className="absolute -inset-0.5 rounded-2xl bg-gradient-to-tr from-primary to-amber-500 opacity-40 blur-xs transition group-hover:opacity-75" />
          <Plus className="relative size-6 stroke-[2.5]" aria-hidden />
        </button>
        <MobilePublishSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
      </>
    );
  }

  return (
    <Menu
      className="w-80"
      align="end"
      trigger={(props) => (
        <button
          type="button"
          aria-haspopup="menu"
          {...props}
          className={cn(
            'inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-primary pr-2 pl-3 text-body-sm font-semibold text-on-primary shadow-[0_1px_2px_rgba(10,10,11,0.12),inset_0_1px_0_rgba(255,255,255,0.18)] transition-colors hover:bg-primary-hover',
            className,
          )}
        >
          <Plus className="size-4" aria-hidden />
          <span>{t('nav.publish')}</span>
          <Kbd className="ml-1 hidden border-white/25 bg-white/15 text-on-primary lg:inline-flex">N</Kbd>
        </button>
      )}
    >
      {PUBLISH_ITEMS.map((item, index) => {
        const Icon = ICONS[index] ?? PenSquare;
        const label = item.msgKey ? t(item.msgKey) : item.label;
        const hint = item.hintKey ? t(item.hintKey) : item.hint;
        return (
          <MenuItem key={item.href} href={item.href}>
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-line bg-container-low">
              <Icon className="!text-ink-muted" aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block font-medium">{label}</span>
              <span className="block text-body-sm text-ink-muted">{hint}</span>
            </span>
          </MenuItem>
        );
      })}
    </Menu>
  );
}
